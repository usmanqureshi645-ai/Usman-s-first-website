import { getUserFromRequest } from '../lib/auth.js';

export default async function handler(req, res) {
  const user = getUserFromRequest(req);
  if (!user) {
    res.status(200).json({ loggedIn: false });
    return;
  }
  res.status(200).json({ loggedIn: true, name: user.name, email: user.email });
}
