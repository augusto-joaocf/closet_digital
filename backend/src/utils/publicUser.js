export function publicUser(user) {
  return { id: user.id, name: user.name, email: user.email, avatar_url: user.avatar_url ?? null };
}
