-- login 2FA exemptions for app store review accounts
CREATE TABLE IF NOT EXISTS login_2fa_exemptions (
  email TEXT PRIMARY KEY,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE OR REPLACE FUNCTION guard_login_2fa_exemptions() RETURNS trigger AS $$
BEGIN
  IF coalesce(current_setting('orangtask.manual_db_edit', true), '') <> 'on' THEN
    RAISE EXCEPTION
      'login_2fa_exemptions is manual-edit only'
      USING HINT = 'Run: BEGIN; SET LOCAL orangtask.manual_db_edit = ''on''; <your statement>; COMMIT;';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS guard_login_2fa_exemptions ON login_2fa_exemptions;
CREATE TRIGGER guard_login_2fa_exemptions
  BEFORE INSERT OR UPDATE OR DELETE ON login_2fa_exemptions
  FOR EACH ROW EXECUTE FUNCTION guard_login_2fa_exemptions();
