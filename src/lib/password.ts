// Password policy — shared by the set-password page and the auth API routes.
// 8–20 characters, must contain at least one digit.
export function passwordProblem(pw: string): string | null {
  if (pw.length < 8 || pw.length > 20) return "Нууц үг 8–20 тэмдэгт байх ёстой";
  if (!/[0-9]/.test(pw)) return "Нууц үг дор хаяж нэг тоо агуулсан байх ёстой";
  return null;
}
