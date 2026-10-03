const TOKEN_KEY = 'ecoclean_token';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) => (t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY));

/** JSON fetch wrapper. Throws an Error with `.status` and optional `.field` on failure. */
export async function api(path, { method = 'GET', body, signal } = {}) {
  const token = getToken();
  let res;
  try {
    res = await fetch(path, {
      method,
      signal,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (e) {
    if (e.name === 'AbortError') throw e;
    throw new Error("Can't reach the server. Check your connection and try again.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || 'Something went wrong. Please try again.');
    err.status = res.status;
    err.field = data.field;
    throw err;
  }
  return data;
}

export const formatPoints = (n) => Number(n || 0).toLocaleString('en-IN');
export const pointsToRupees = (pts) => {
  const rs = Number(pts || 0) / 50;
  return rs % 1 === 0 ? rs.toFixed(0) : rs.toFixed(2);
};
export const formatRupees = (pts) => `₹${pointsToRupees(pts)}`;
export const formatPointsWithRupees = (pts) => `${formatPoints(pts)} pts (₹${pointsToRupees(pts)})`;
