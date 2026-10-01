// Persistence layer backed by JSONPlaceholder, a free fake REST API.
//
// Same three-function contract as notesRepository.js: findAll, findById,
// create, all async, same note shape ({ id, title, body }). server.js
// only needs its require(...) line changed to point here — nothing else.
//
// Note on userId: JSONPlaceholder returns a userId field on every post, but
// our domain model only has { id, title, body }. We strip userId to keep the
// contract identical to all other persistence implementations.

const BASE_URL = "https://fake.jsonmockapi.com/users?length=10";

// Helper to strip userId from API responses
function stripUserId(post) {
  const { userId, ...rest } = post;
  return rest;
}

async function findAll() {
  const response = await fetch(BASE_URL);
  if (!response.ok) {
    throw new Error(`JSONPlaceholder returned ${response.status}`);
  }
  const posts = await response.json();
  return posts.map(stripUserId);
}

async function findById(id) {
  const response = await fetch(`${BASE_URL}/${id}`);
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`JSONPlaceholder returned ${response.status}`);
  }
  const post = await response.json();
  return stripUserId(post);
}

async function create(title, body) {
  const response = await fetch(BASE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, body }),
  });
  if (!response.ok) {
    throw new Error(`JSONPlaceholder returned ${response.status}`);
  }
  const post = await response.json();
  // POST response includes id but not userId, but we still run it through
  // stripUserId for consistency (it's a no-op if userId is absent)
  return stripUserId(post);
}

module.exports = { findAll, findById, create };
