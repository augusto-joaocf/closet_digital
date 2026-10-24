import { useEffect, useState } from 'react';

export default function useFormAction() {
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (Object.keys(errors).length) document.querySelector('form [aria-invalid="true"]')?.focus();
  }, [errors]);
  async function run(action) {
    setErrors({});
    setBusy(true);
    try { await action(); return true; }
    catch (error) { setErrors(error.fields || { form: error.message }); return false; }
    finally { setBusy(false); }
  }
  return { errors, setErrors, busy, run };
}
