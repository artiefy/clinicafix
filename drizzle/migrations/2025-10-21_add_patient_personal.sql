ALTER TABLE patients
  ADD COLUMN city varchar(128),
  ADD COLUMN phone varchar(32),
  ADD COLUMN blood_type varchar(8),
  ADD COLUMN birth_date date,
  ADD COLUMN extra_comment text;
