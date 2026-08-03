/**
 * Default display names: a random adjective + noun pair, no numbers -
 * "Steadfast Heron", "Amiable Tugboat". Users can change theirs any time.
 * Pairs aren't guaranteed unique (91 × 96 combos); display names are labels,
 * not identities - the uid is the identity.
 */

const ADJECTIVES = [
  'Amiable', 'Ardent', 'Astute', 'Balanced', 'Bold', 'Brave', 'Breezy',
  'Bright', 'Candid', 'Capable', 'Cheerful', 'Civic', 'Clever', 'Composed',
  'Cordial', 'Curious', 'Daring', 'Dapper', 'Devoted', 'Diligent', 'Earnest',
  'Eager', 'Fearless', 'Frank', 'Friendly', 'Genuine', 'Gentle', 'Gracious',
  'Hardy', 'Honest', 'Hopeful', 'Humble', 'Intrepid', 'Jovial', 'Keen',
  'Kindly', 'Lively', 'Loyal', 'Lucid', 'Mellow', 'Merry', 'Mighty', 'Modest',
  'Neighborly', 'Nimble', 'Noble', 'Observant', 'Patient', 'Peppy', 'Plucky',
  'Polite', 'Practical', 'Proud', 'Prudent', 'Punctual', 'Quick', 'Quiet',
  'Radiant', 'Reliable', 'Resolute', 'Robust', 'Rustic', 'Sage', 'Scrappy',
  'Sensible', 'Sharp', 'Sincere', 'Snappy', 'Spirited', 'Spry', 'Staunch',
  'Steadfast', 'Stellar', 'Stoic', 'Sturdy', 'Sunny', 'Swift', 'Tactful',
  'Tenacious', 'Thoughtful', 'Tidy', 'Tireless', 'Trusty', 'Upbeat',
  'Valiant', 'Vibrant', 'Vigilant', 'Warm', 'Wise', 'Witty', 'Zesty',
];

// Nouns lean local: lake, prairie, and el-adjacent things a Chicagoan would clock.
const NOUNS = [
  'Acorn', 'Anchor', 'Badger', 'Beacon', 'Bison', 'Bluebird', 'Bobcat',
  'Boulevard', 'Bridge', 'Bungalow', 'Cardinal', 'Chickadee', 'Compass',
  'Condor', 'Cricket', 'Cyclist', 'Dune', 'Elm', 'Ember', 'Falcon', 'Ferry',
  'Firefly', 'Flag', 'Fox', 'Gazebo', 'Glacier', 'Greenway', 'Harbor',
  'Hawk', 'Heron', 'Hickory', 'Kayak', 'Kestrel', 'Kite', 'Lakefront',
  'Lantern', 'Lighthouse', 'Lilac', 'Loon', 'Magnolia', 'Mallard', 'Maple',
  'Marina', 'Meadow', 'Mockingbird', 'Monarch', 'Mosaic', 'Mural', 'Oak',
  'Onion', 'Oriole', 'Osprey', 'Otter', 'Owl', 'Paddle', 'Pelican', 'Pier',
  'Pigeon', 'Plover', 'Prairie', 'Quill', 'Raccoon', 'Rambler', 'Raven',
  'Redwood', 'Riverwalk', 'Robin', 'Rookery', 'Sailboat', 'Sandpiper',
  'Skyline', 'Sparrow', 'Spruce', 'Squirrel', 'Star', 'Steeple', 'Streetcar',
  'Sycamore', 'Tamarack', 'Terrace', 'Thrush', 'Trolley', 'Tugboat', 'Turbine',
  'Viaduct', 'Violet', 'Warbler', 'Waterwheel', 'Willow', 'Windmill', 'Wren',
  'Zephyr', 'Zinnia', 'Compasswork', 'Gale', 'Harborlight',
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function randomDisplayName(): string {
  return `${pick(ADJECTIVES)} ${pick(NOUNS)}`;
}

export const DISPLAY_NAME_MAX = 30;

export function validateDisplayName(name: string): string | null {
  const trimmed = name.trim();
  if (trimmed.length < 3) return 'Display name must be at least 3 characters.';
  if (trimmed.length > DISPLAY_NAME_MAX) return `Display name must be ${DISPLAY_NAME_MAX} characters or fewer.`;
  return null;
}
