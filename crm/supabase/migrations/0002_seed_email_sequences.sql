-- Default email sequences, one pair (high_ticket / standard) per trigger.

insert into email_sequences (name, tier, trigger_stage, delay_hours, subject, body_template, active)
values
  ('Lead nudge (high ticket)', 'high_ticket', 'lead', 48,
   'Still thinking it over?',
   'Hi {{name}}, just checking in — happy to answer any questions about the high-ticket coaching programme whenever suits you.',
   true),
  ('Lead nudge (standard)', 'standard', 'lead', 48,
   'Still thinking it over?',
   'Hi {{name}}, just checking in — happy to answer any questions about coaching whenever suits you.',
   true),

  ('No-show follow-up (high ticket)', 'high_ticket', 'call_booked', 24,
   'Missed you on the call',
   'Hi {{name}}, sorry we missed each other for your call — want to grab a new time?',
   true),
  ('No-show follow-up (standard)', 'standard', 'call_booked', 24,
   'Missed you on the call',
   'Hi {{name}}, sorry we missed each other for your call — want to grab a new time?',
   true),

  ('Proposal check-in (high ticket)', 'high_ticket', 'proposal_sent', 72,
   'Any questions on your proposal?',
   'Hi {{name}}, wanted to check in on the proposal I sent over — happy to talk through any of it.',
   true),
  ('Proposal check-in (standard)', 'standard', 'proposal_sent', 72,
   'Any questions on your proposal?',
   'Hi {{name}}, wanted to check in on the proposal I sent over — happy to talk through any of it.',
   true),

  ('Welcome (high ticket)', 'high_ticket', 'won', 0,
   'Welcome to Plus4Performance',
   'Hi {{name}}, welcome aboard! Here''s what happens next on the high-ticket coaching programme.',
   true),
  ('Welcome (standard)', 'standard', 'won', 0,
   'Welcome to Plus4Performance',
   'Hi {{name}}, welcome aboard! Here''s what happens next.',
   true);
