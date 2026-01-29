-- Seed default users (run once when users table is empty)
-- Change passwords after first login in production.
--
-- Owner:     owner@boatbuild.com  / owner123
-- Operation: kaan@boatbuild.com   / operation123

INSERT INTO users (email, password_hash, full_name, role)
VALUES
  ('owner@boatbuild.com', '$2a$12$7z75BaOIT8H5TOmHgD2kFu7u9xFswC2WY5F4/dJUwE2fGkgkk5Lh.', 'Owner', 'OWNER'),
  ('kaan@boatbuild.com', '$2a$12$y33R1s/pTJo8wp.gB8oKzOixXfK7EE4.0RbdaT78YmNHlIWVCct6.', 'Kaan (Operation)', 'OPERATION')
ON CONFLICT (email) DO NOTHING;
