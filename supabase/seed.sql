-- =============================================================================
-- seed.sql - GUTECH LMS Portal demo data
--
-- 1 admin, 2 teachers, 5 students, 3 courses, plus assignments, quizzes,
-- marks, announcements, chat and complaints so every role can be walked
-- end to end. All demo accounts use the password:  Gutech@2026
--
-- Dates are relative to now() so the demo always has upcoming and past work.
-- Safe to run on a fresh database (supabase db reset) or pasted into the
-- hosted Supabase SQL editor after the migrations.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Helper: create a GoTrue-compatible auth user + identity + profile
-- -----------------------------------------------------------------------------
create or replace function pg_temp.create_demo_user(
  p_id uuid,
  p_email text,
  p_full_name text,
  p_role public.user_role,
  p_roll_no text default null,
  p_must_change boolean default false
) returns void
language plpgsql
as $$
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change, email_change_token_new,
    email_change_token_current, phone_change, phone_change_token, reauthentication_token
  ) values (
    '00000000-0000-0000-0000-000000000000', p_id, 'authenticated', 'authenticated', p_email,
    extensions.crypt('Gutech@2026', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('full_name', p_full_name, 'role', p_role),
    now() - interval '30 days', now(),
    '', '', '', '', '', '', '', ''
  );

  insert into auth.identities (
    id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
  ) values (
    gen_random_uuid(), p_id, p_id::text,
    jsonb_build_object('sub', p_id::text, 'email', p_email, 'email_verified', true),
    'email', now(), now(), now()
  );

  insert into public.profiles (id, full_name, email, role, roll_no, must_change_password, created_at)
  values (p_id, p_full_name, p_email, p_role, p_roll_no, p_must_change, now() - interval '30 days');
end;
$$;

-- -----------------------------------------------------------------------------
-- Users
-- -----------------------------------------------------------------------------
select pg_temp.create_demo_user('11111111-1111-4111-8111-111111111111', 'admin@gutech.demo',     'Registrar Office (Admin)', 'admin');
select pg_temp.create_demo_user('22222222-2222-4222-8222-222222222221', 'aisha.balushi@gutech.demo', 'Dr. Aisha Al-Balushi', 'teacher');
select pg_temp.create_demo_user('22222222-2222-4222-8222-222222222222', 'omar.rawahi@gutech.demo',   'Dr. Omar Al-Rawahi',   'teacher');
select pg_temp.create_demo_user('33333333-3333-4333-8333-333333333331', 'fatima.hinai@gutech.demo',  'Fatima Al-Hinai',  'student', 'GU-24-001');
select pg_temp.create_demo_user('33333333-3333-4333-8333-333333333332', 'yousuf.lawati@gutech.demo', 'Yousuf Al-Lawati', 'student', 'GU-24-002');
select pg_temp.create_demo_user('33333333-3333-4333-8333-333333333333', 'maryam.kindi@gutech.demo',  'Maryam Al-Kindi',  'student', 'GU-24-003');
select pg_temp.create_demo_user('33333333-3333-4333-8333-333333333334', 'salim.farsi@gutech.demo',   'Salim Al-Farsi',   'student', 'GU-24-004');
-- This student still holds a temporary password and is forced to change it on first login.
select pg_temp.create_demo_user('33333333-3333-4333-8333-333333333335', 'noor.saadi@gutech.demo',    'Noor Al-Saadi',    'student', 'GU-24-005', true);

-- -----------------------------------------------------------------------------
-- Courses, teachers, enrollments
-- -----------------------------------------------------------------------------
insert into public.courses (id, code, title, description) values
  ('44444444-4444-4444-8444-444444444441', 'CS101',   'Introduction to Programming',
   'Problem solving with Python: variables, control flow, functions, and testing.'),
  ('44444444-4444-4444-8444-444444444442', 'CS201',   'Data Structures and Algorithms',
   'Lists, stacks, queues, trees, hashing, sorting and algorithmic complexity.'),
  ('44444444-4444-4444-8444-444444444443', 'MATH150', 'Discrete Mathematics',
   'Logic, sets, relations, combinatorics and graph theory for computing.');

insert into public.course_teachers (course_id, teacher_id) values
  ('44444444-4444-4444-8444-444444444441', '22222222-2222-4222-8222-222222222221'),
  ('44444444-4444-4444-8444-444444444442', '22222222-2222-4222-8222-222222222222'),
  ('44444444-4444-4444-8444-444444444443', '22222222-2222-4222-8222-222222222221'),
  ('44444444-4444-4444-8444-444444444443', '22222222-2222-4222-8222-222222222222');

insert into public.enrollments (course_id, student_id) values
  ('44444444-4444-4444-8444-444444444441', '33333333-3333-4333-8333-333333333331'),
  ('44444444-4444-4444-8444-444444444441', '33333333-3333-4333-8333-333333333332'),
  ('44444444-4444-4444-8444-444444444441', '33333333-3333-4333-8333-333333333333'),
  ('44444444-4444-4444-8444-444444444441', '33333333-3333-4333-8333-333333333334'),
  ('44444444-4444-4444-8444-444444444441', '33333333-3333-4333-8333-333333333335'),
  ('44444444-4444-4444-8444-444444444442', '33333333-3333-4333-8333-333333333331'),
  ('44444444-4444-4444-8444-444444444442', '33333333-3333-4333-8333-333333333332'),
  ('44444444-4444-4444-8444-444444444442', '33333333-3333-4333-8333-333333333333'),
  ('44444444-4444-4444-8444-444444444443', '33333333-3333-4333-8333-333333333331'),
  ('44444444-4444-4444-8444-444444444443', '33333333-3333-4333-8333-333333333333'),
  ('44444444-4444-4444-8444-444444444443', '33333333-3333-4333-8333-333333333334'),
  ('44444444-4444-4444-8444-444444444443', '33333333-3333-4333-8333-333333333335');

-- -----------------------------------------------------------------------------
-- Assignments
-- -----------------------------------------------------------------------------
insert into public.assignments (id, course_id, created_by, title, instructions, max_marks, due_at, allow_late) values
  ('55555555-5555-4555-8555-555555555551', '44444444-4444-4444-8444-444444444441', '22222222-2222-4222-8222-222222222221',
   'Lab 1: Hello, Python',
   'Write a program that asks for the user''s name and prints a personalised greeting. Submit your .py file zipped or paste the code.',
   10, now() - interval '7 days', false),
  ('55555555-5555-4555-8555-555555555552', '44444444-4444-4444-8444-444444444441', '22222222-2222-4222-8222-222222222221',
   'Lab 2: Control Flow',
   'Implement FizzBuzz and a number-guessing game using loops and conditionals. Include a short reflection on edge cases.',
   20, now() + interval '5 days', false),
  ('55555555-5555-4555-8555-555555555553', '44444444-4444-4444-8444-444444444442', '22222222-2222-4222-8222-222222222222',
   'Linked List Implementation',
   'Implement a singly linked list with insert, delete, search and reverse. Analyse the time complexity of each operation.',
   25, now() + interval '10 days', true),
  ('55555555-5555-4555-8555-555555555554', '44444444-4444-4444-8444-444444444443', '22222222-2222-4222-8222-222222222221',
   'Problem Set 1: Propositional Logic',
   'Solve problems 1-12 from chapter 1. Show truth tables where required. Upload a PDF or a photo of your work.',
   30, now() - interval '3 days', true);

insert into public.submissions (assignment_id, student_id, text_answer, submitted_at, is_late, marks_obtained, feedback, graded_by, graded_at) values
  ('55555555-5555-4555-8555-555555555551', '33333333-3333-4333-8333-333333333331',
   E'name = input("Your name: ")\nprint(f"Hello, {name}! Welcome to GUtech.")', now() - interval '8 days', false,
   9.5, 'Clean and readable. Consider stripping whitespace from the input.', '22222222-2222-4222-8222-222222222221', now() - interval '6 days'),
  ('55555555-5555-4555-8555-555555555551', '33333333-3333-4333-8333-333333333332',
   'print("Hello " + input())', now() - interval '7 days 2 hours', false,
   7, 'Works, but the prompt is missing and the output lacks punctuation.', '22222222-2222-4222-8222-222222222221', now() - interval '6 days'),
  ('55555555-5555-4555-8555-555555555551', '33333333-3333-4333-8333-333333333333',
   E'n = input("Name? ")\nprint("Hi", n)', now() - interval '9 days', false,
   8, 'Good. Use f-strings for clearer formatting.', '22222222-2222-4222-8222-222222222221', now() - interval '6 days'),
  ('55555555-5555-4555-8555-555555555552', '33333333-3333-4333-8333-333333333331',
   E'for i in range(1, 101):\n    print("FizzBuzz" if i % 15 == 0 else "Fizz" if i % 3 == 0 else "Buzz" if i % 5 == 0 else i)',
   now() - interval '1 day', false, null, null, null, null),
  ('55555555-5555-4555-8555-555555555554', '33333333-3333-4333-8333-333333333331',
   'All twelve problems solved; truth tables attached inline. Problem 7 is a tautology.', now() - interval '4 days', false,
   27, 'Excellent work. Minor slip in problem 9.', '22222222-2222-4222-8222-222222222221', now() - interval '2 days'),
  ('55555555-5555-4555-8555-555555555554', '33333333-3333-4333-8333-333333333334',
   'Solutions for problems 1-12.', now() - interval '2 days', true,
   null, null, null, null);

-- -----------------------------------------------------------------------------
-- Quizzes
-- -----------------------------------------------------------------------------
insert into public.quizzes (id, course_id, created_by, title, description, time_limit_minutes, opens_at, closes_at, is_published, shuffle_questions) values
  ('66666666-6666-4666-8666-666666666661', '44444444-4444-4444-8444-444444444441', '22222222-2222-4222-8222-222222222221',
   'Quiz 1: Python Basics', 'Variables, types and expressions.', 10,
   now() - interval '10 days', now() - interval '5 days', true, false),
  ('66666666-6666-4666-8666-666666666662', '44444444-4444-4444-8444-444444444441', '22222222-2222-4222-8222-222222222221',
   'Quiz 2: Loops and Functions', 'Covers for/while loops, range(), and defining functions.', 15,
   now() - interval '1 hour', now() + interval '7 days', true, true),
  ('66666666-6666-4666-8666-666666666663', '44444444-4444-4444-8444-444444444443', '22222222-2222-4222-8222-222222222221',
   'Logic Warm-up', 'Draft quiz - not yet published.', 20,
   now() + interval '2 days', now() + interval '9 days', false, false);

insert into public.quiz_questions (id, quiz_id, position, type, prompt, options, marks) values
  -- Quiz 1 (max 6)
  ('77777777-7777-4777-8777-777777777711', '66666666-6666-4666-8666-666666666661', 0, 'mcq_single',
   'What is the type of the expression 7 / 2 in Python 3?',
   '[{"id":"a","text":"int"},{"id":"b","text":"float"},{"id":"c","text":"str"},{"id":"d","text":"decimal"}]', 2),
  ('77777777-7777-4777-8777-777777777712', '66666666-6666-4666-8666-666666666661', 1, 'mcq_multi',
   'Which of the following are valid variable names?',
   '[{"id":"a","text":"total_marks"},{"id":"b","text":"2nd_place"},{"id":"c","text":"_hidden"},{"id":"d","text":"class"}]', 3),
  ('77777777-7777-4777-8777-777777777713', '66666666-6666-4666-8666-666666666661', 2, 'true_false',
   'Python is dynamically typed.',
   '[{"id":"true","text":"True"},{"id":"false","text":"False"}]', 1),
  -- Quiz 2 (max 6)
  ('77777777-7777-4777-8777-777777777721', '66666666-6666-4666-8666-666666666662', 0, 'mcq_single',
   'How many times does the body of  for i in range(2, 10, 3)  execute?',
   '[{"id":"a","text":"2"},{"id":"b","text":"3"},{"id":"c","text":"4"},{"id":"d","text":"8"}]', 2),
  ('77777777-7777-4777-8777-777777777722', '66666666-6666-4666-8666-666666666662', 1, 'mcq_multi',
   'Which statements about Python functions are true?',
   '[{"id":"a","text":"A function without return returns None"},{"id":"b","text":"Default arguments are evaluated on every call"},{"id":"c","text":"Functions are first-class objects"},{"id":"d","text":"def must be followed by a type annotation"}]', 2),
  ('77777777-7777-4777-8777-777777777723', '66666666-6666-4666-8666-666666666662', 2, 'true_false',
   'A while loop always executes its body at least once.',
   '[{"id":"true","text":"True"},{"id":"false","text":"False"}]', 1),
  ('77777777-7777-4777-8777-777777777724', '66666666-6666-4666-8666-666666666662', 3, 'mcq_single',
   'Which keyword exits the nearest enclosing loop?',
   '[{"id":"a","text":"exit"},{"id":"b","text":"return"},{"id":"c","text":"break"},{"id":"d","text":"continue"}]', 1),
  -- Logic warm-up (draft)
  ('77777777-7777-4777-8777-777777777731', '66666666-6666-4666-8666-666666666663', 0, 'true_false',
   'p -> q is logically equivalent to (not p) or q.',
   '[{"id":"true","text":"True"},{"id":"false","text":"False"}]', 1);

insert into public.quiz_answers (question_id, correct_option_ids) values
  ('77777777-7777-4777-8777-777777777711', array['b']),
  ('77777777-7777-4777-8777-777777777712', array['a', 'c']),
  ('77777777-7777-4777-8777-777777777713', array['true']),
  ('77777777-7777-4777-8777-777777777721', array['b']),
  ('77777777-7777-4777-8777-777777777722', array['a', 'c']),
  ('77777777-7777-4777-8777-777777777723', array['false']),
  ('77777777-7777-4777-8777-777777777724', array['c']),
  ('77777777-7777-4777-8777-777777777731', array['true']);

-- Completed attempts for Quiz 1 (scores match the answer key above)
insert into public.quiz_attempts (quiz_id, student_id, started_at, expires_at, submitted_at, question_order, answers, score) values
  ('66666666-6666-4666-8666-666666666661', '33333333-3333-4333-8333-333333333331',
   now() - interval '8 days', now() - interval '8 days' + interval '10 minutes', now() - interval '8 days' + interval '6 minutes',
   array['77777777-7777-4777-8777-777777777711', '77777777-7777-4777-8777-777777777712', '77777777-7777-4777-8777-777777777713']::uuid[],
   '{"77777777-7777-4777-8777-777777777711":["b"],"77777777-7777-4777-8777-777777777712":["a","c"],"77777777-7777-4777-8777-777777777713":["true"]}',
   6),
  ('66666666-6666-4666-8666-666666666661', '33333333-3333-4333-8333-333333333332',
   now() - interval '7 days', now() - interval '7 days' + interval '10 minutes', now() - interval '7 days' + interval '9 minutes',
   array['77777777-7777-4777-8777-777777777711', '77777777-7777-4777-8777-777777777712', '77777777-7777-4777-8777-777777777713']::uuid[],
   '{"77777777-7777-4777-8777-777777777711":["b"],"77777777-7777-4777-8777-777777777712":["a"],"77777777-7777-4777-8777-777777777713":["true"]}',
   3),
  ('66666666-6666-4666-8666-666666666661', '33333333-3333-4333-8333-333333333333',
   now() - interval '9 days', now() - interval '9 days' + interval '10 minutes', now() - interval '9 days' + interval '8 minutes',
   array['77777777-7777-4777-8777-777777777711', '77777777-7777-4777-8777-777777777712', '77777777-7777-4777-8777-777777777713']::uuid[],
   '{"77777777-7777-4777-8777-777777777711":["a"],"77777777-7777-4777-8777-777777777712":["a","c"],"77777777-7777-4777-8777-777777777713":["true"]}',
   4);

-- -----------------------------------------------------------------------------
-- Announcements
-- -----------------------------------------------------------------------------
insert into public.announcements (course_id, author_id, title, body, is_pinned, created_at) values
  (null, '11111111-1111-4111-8111-111111111111', 'Welcome to the GUTECH LMS Portal',
   'All course materials, assignments, quizzes and marks are now available in one place. If anything looks wrong, raise a complaint from the Complaints page and the registrar team will respond.',
   true, now() - interval '20 days'),
  (null, '11111111-1111-4111-8111-111111111111', 'Mid-semester break',
   'Classes are suspended next week for the mid-semester break. Assignment deadlines falling in the break have already been adjusted by your instructors.',
   false, now() - interval '2 days'),
  ('44444444-4444-4444-8444-444444444441', '22222222-2222-4222-8222-222222222221', 'Lab 2 is live',
   'Lab 2 (Control Flow) is now open. Office hours are Tuesday 10:00-12:00 in room B-214.',
   false, now() - interval '1 day'),
  ('44444444-4444-4444-8444-444444444442', '22222222-2222-4222-8222-222222222222', 'Reading for week 6',
   'Please read chapter 4 (Linked Lists) before Thursday''s lecture.',
   false, now() - interval '3 days'),
  ('44444444-4444-4444-8444-444444444443', '22222222-2222-4222-8222-222222222221', 'Problem Set 1 feedback released',
   'Marks and feedback for Problem Set 1 are available under My Marks.',
   true, now() - interval '2 days');

-- -----------------------------------------------------------------------------
-- Classroom chat
-- -----------------------------------------------------------------------------
insert into public.chat_messages (course_id, sender_id, body, created_at) values
  ('44444444-4444-4444-8444-444444444441', '22222222-2222-4222-8222-222222222221',
   'Welcome to the CS101 classroom chat! Use this space for quick questions about labs.', now() - interval '6 days'),
  ('44444444-4444-4444-8444-444444444441', '33333333-3333-4333-8333-333333333331',
   'For Lab 2, should the guessing game limit the number of attempts?', now() - interval '2 days'),
  ('44444444-4444-4444-8444-444444444441', '22222222-2222-4222-8222-222222222221',
   'Good question - yes, allow at most 7 guesses and tell the player when they run out.', now() - interval '2 days' + interval '20 minutes'),
  ('44444444-4444-4444-8444-444444444441', '33333333-3333-4333-8333-333333333332',
   'Thanks! Is the reflection part graded separately?', now() - interval '1 day'),
  ('44444444-4444-4444-8444-444444444442', '22222222-2222-4222-8222-222222222222',
   'Reminder: bring your laptops on Thursday for the live coding session.', now() - interval '3 days');

-- -----------------------------------------------------------------------------
-- Complaints & notifications
-- -----------------------------------------------------------------------------
insert into public.complaints (id, raised_by, course_id, category, subject, description, status, admin_response, resolved_by, resolved_at, created_at) values
  ('88888888-8888-4888-8888-888888888881', '33333333-3333-4333-8333-333333333331', null, 'technical',
   'Wi-Fi drops in the library',
   'The campus Wi-Fi disconnects every few minutes on the second floor of the library, which makes it hard to submit work.',
   'open', null, null, null, now() - interval '1 day'),
  ('88888888-8888-4888-8888-888888888882', '33333333-3333-4333-8333-333333333332', '44444444-4444-4444-8444-444444444441', 'academic',
   'Lab 1 mark clarification',
   'I would like to understand which part of my Lab 1 submission lost marks so I can improve.',
   'resolved', 'Your instructor has added detailed feedback to the submission. Please check My Marks.',
   '11111111-1111-4111-8111-111111111111', now() - interval '4 days', now() - interval '6 days'),
  ('88888888-8888-4888-8888-888888888883', '22222222-2222-4222-8222-222222222222', null, 'facility',
   'Projector in B-110 is faulty',
   'The projector in lecture hall B-110 flickers constantly and the HDMI port is loose.',
   'in_review', 'Facilities team has been notified and will inspect it this week.', null, null, now() - interval '3 days');

insert into public.notifications (user_id, kind, title, body, link, created_at) values
  ('33333333-3333-4333-8333-333333333332', 'complaint_status', 'Complaint resolved',
   'Your complaint "Lab 1 mark clarification" was marked as resolved.', '/complaints', now() - interval '4 days'),
  ('22222222-2222-4222-8222-222222222222', 'complaint_status', 'Complaint in review',
   'Your complaint "Projector in B-110 is faulty" is now in review.', '/complaints', now() - interval '2 days');

-- -----------------------------------------------------------------------------
-- Audit trail examples
-- -----------------------------------------------------------------------------
insert into public.audit_log (actor_id, action, entity, entity_id, details, at) values
  ('11111111-1111-4111-8111-111111111111', 'course.create', 'course', '44444444-4444-4444-8444-444444444441', '{"code":"CS101"}', now() - interval '30 days'),
  ('11111111-1111-4111-8111-111111111111', 'course.create', 'course', '44444444-4444-4444-8444-444444444442', '{"code":"CS201"}', now() - interval '30 days'),
  ('11111111-1111-4111-8111-111111111111', 'course.create', 'course', '44444444-4444-4444-8444-444444444443', '{"code":"MATH150"}', now() - interval '30 days'),
  ('22222222-2222-4222-8222-222222222221', 'submission.grade', 'submission', null, '{"assignment":"Lab 1: Hello, Python"}', now() - interval '6 days'),
  ('11111111-1111-4111-8111-111111111111', 'complaint.status', 'complaint', '88888888-8888-4888-8888-888888888882', '{"status":"resolved"}', now() - interval '4 days');
