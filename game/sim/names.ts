// Word lists for names. Every pair fits the 16 character name limit.
const PLAYER_FIRST = ["Soggy", "Grumpy", "Sneaky", "Wobbly", "Sleepy", "Jumpy", "Fuzzy", "Cranky", "Dizzy", "Salty", "Bouncy", "Clumsy", "Mighty", "Rowdy", "Zesty", "Sassy"];
const PLAYER_SECOND = ["Waffle", "Turnip", "Pigeon", "Noodle", "Pickle", "Walrus", "Muffin", "Badger", "Potato", "Goblin", "Toaster", "Llama", "Biscuit", "Hamster", "Sock", "Cactus"];
const ROOM_FIRST = ["Quiet", "Rusty", "Folded", "Dusty", "Inky", "Paper", "Olive", "Crisp", "Faded", "Bright", "Hidden", "Narrow"];
const ROOM_SECOND = ["Harbor", "Ledger", "Attic", "Garden", "Depot", "Studio", "Cellar", "Bridge", "Market", "Quarry", "Annex", "Yard"];

const pick = (list: string[], random: () => number) => list[Math.floor(random() * list.length) % list.length];

/** A funny name for a player who typed none. */
export const randomName = (random: () => number = Math.random) => `${pick(PLAYER_FIRST, random)} ${pick(PLAYER_SECOND, random)}`;
/** A name for a new room. */
export const roomName = (random: () => number = Math.random) => `${pick(ROOM_FIRST, random)} ${pick(ROOM_SECOND, random)}`;
