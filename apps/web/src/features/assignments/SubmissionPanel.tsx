import { useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Download, MessageSquareQuote, Send } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { DOCUMENT_ACCEPT, FileDropzone } from '@/components/common/FileDropzone';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/misc';
import { errorMessage, openSignedUrl, upload } from '@/lib/api';
import type { Assignment } from '@/lib/types';
import { formatDateTime, formatMarks } from '@/lib/utils';

export function SubmissionPanel({ assignment }: { assignment: Assignment }) {
  const queryClient = useQueryClient();
  const submission = assignment.submission ?? null;
  const [text, setText] = useState(submission?.textAnswer ?? '');
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(!submission);

  const pastDue = new Date(assignment.dueAt) < new Date();
  const closed = pastDue && !assignment.allowLate;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!text.trim() && !file) {
      setError('Write an answer or attach a file before submitting.');
      return;
    }
    const form = new FormData();
    if (text.trim()) form.append('textAnswer', text.trim());
    if (file) form.append('file', file);
    setProgress(0);
    try {
      await upload(`/assignments/${assignment.id}/submission`, form, {
        method: 'PUT',
        onProgress: setProgress,
      });
      toast.success(submission ? 'Submission replaced' : 'Assignment submitted');
      setFile(null);
      setEditing(false);
      void queryClient.invalidateQueries({ queryKey: ['assignment', assignment.id] });
      void queryClient.invalidateQueries({ queryKey: ['assignments'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setProgress(null);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>{submission ? 'Your submission' : 'Submit your work'}</CardTitle>
          <CardDescription>
            {closed
              ? 'The deadline has passed and late submissions are not accepted.'
              : pastDue
                ? 'The deadline has passed. Late work is accepted but will be marked late.'
                : 'You can resubmit until the deadline. Resubmitting replaces your previous work and clears any grade.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {submission && !editing && (
            <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
              <p className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="size-4 text-success" /> Submitted{' '}
                {formatDateTime(submission.submittedAt)}
                {submission.isLate && <span className="font-medium text-warning">(late)</span>}
              </p>
              {submission.textAnswer && (
                <pre className="max-h-64 overflow-auto rounded-md bg-card p-3 font-mono text-xs whitespace-pre-wrap">
                  {submission.textAnswer}
                </pre>
              )}
              {submission.fileName && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    openSignedUrl(`/submissions/${submission.id}/file`).catch((e) =>
                      toast.error(errorMessage(e)),
                    )
                  }
                >
                  <Download /> {submission.fileName}
                </Button>
              )}
              {!closed && (
                <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
                  Replace submission
                </Button>
              )}
            </div>
          )}
          {editing && !closed && (
            <form onSubmit={submit} className="space-y-4" noValidate>
              {error && (
                <p
                  role="alert"
                  className="rounded-lg border border-destructive/30 bg-destructive/8 p-3 text-sm text-destructive"
                >
                  {error}
                </p>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="answer">Written answer</Label>
                <Textarea
                  id="answer"
                  rows={8}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  maxLength={50000}
                  placeholder="Type or paste your answer…"
                />
              </div>
              <div className="space-y-1.5">
                <Label>File (optional)</Label>
                <FileDropzone
                  file={file}
                  onFile={setFile}
                  accept={DOCUMENT_ACCEPT}
                  maxBytes={25 * 1024 * 1024}
                  hint="One file · PDF, DOCX, PPTX, ZIP or image · max 25 MB"
                  id="submission-file"
                />
              </div>
              {progress !== null && <Progress value={progress} />}
              <div className="flex gap-2">
                <Button type="submit" loading={progress !== null}>
                  {progress === null && <Send />} {submission ? 'Resubmit' : 'Submit'}
                </Button>
                {submission && (
                  <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
                    Cancel
                  </Button>
                )}
              </div>
            </form>
          )}
          {!submission && closed && (
            <p className="text-sm text-muted-foreground">You did not submit this assignment.</p>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Grade & feedback</CardTitle>
        </CardHeader>
        <CardContent>
          {submission?.gradedAt ? (
            <div className="space-y-4">
              <div>
                <p className="text-4xl font-semibold tracking-tight tabular-nums">
                  {formatMarks(submission.marksObtained)}
                  <span className="text-lg text-muted-foreground">
                    {' '}
                    / {formatMarks(assignment.maxMarks)}
                  </span>
                </p>
                <Progress
                  className="mt-2"
                  value={((submission.marksObtained ?? 0) / assignment.maxMarks) * 100}
                  indicatorClassName="bg-success"
                />
              </div>
              {submission.feedback && (
                <blockquote className="flex gap-2 rounded-lg border bg-muted/30 p-3 text-sm">
                  <MessageSquareQuote className="size-4 shrink-0 text-muted-foreground" />
                  <span className="whitespace-pre-line">{submission.feedback}</span>
                </blockquote>
              )}
              <p className="text-xs text-muted-foreground">
                Graded {formatDateTime(submission.gradedAt)}
              </p>
            </div>
          ) : (
            <p className="py-4 text-sm text-muted-foreground">
              {submission
                ? 'Pending — your teacher has not graded this yet.'
                : 'Submit your work to receive a grade.'}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
