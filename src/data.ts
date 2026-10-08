export type Person = {
  id: string;
  name: string;
  initials: string;
  note: string;
  lastMessage: string;
  time: string;
  unread: number;
  online: boolean;
  pinned?: boolean;
  colors: [string, string];
  reply: string;
};

export type ChatMessage = {
  id: string;
  text: string;
  mine: boolean;
  time: string;
};

export const SELF: Person = {
  id: "maya",
  name: "Maya Chen",
  initials: "MC",
  note: "your quiet corner",
  lastMessage: "",
  time: "",
  unread: 0,
  online: true,
  colors: ["#71D6D0", "#596CE8"],
  reply: "I’m here. Tell me more ✨",
};

export const CONTACTS: Person[] = [
  {
    id: "nia",
    name: "Nia Carter",
    initials: "NC",
    note: "usually has a book nearby",
    lastMessage: "That window seat is ours next time 🌿",
    time: "8:41",
    unread: 2,
    online: true,
    pinned: true,
    colors: ["#D7A0FF", "#7166F5"],
    reply: "Deal. I’ll save you the sunny side ☀️",
  },
  {
    id: "theo",
    name: "Theo Brooks",
    initials: "TB",
    note: "sending voice notes from everywhere",
    lastMessage: "This song feels like that road trip.",
    time: "7:16",
    unread: 0,
    online: false,
    colors: ["#FFBF91", "#EE718E"],
    reply: "Right? It belongs on the drive playlist.",
  },
  {
    id: "aya",
    name: "Aya Nakamura",
    initials: "AN",
    note: "currently somewhere near the sea",
    lastMessage: "The water was almost lavender tonight.",
    time: "5:02",
    unread: 0,
    online: true,
    colors: ["#8AE3E0", "#5D82EA"],
    reply: "I wish you could have seen it with me 💙",
  },
  {
    id: "luca",
    name: "Luca Reyes",
    initials: "LR",
    note: "keeps the group laughing",
    lastMessage: "I am absolutely bringing dessert.",
    time: "3:28",
    unread: 1,
    online: false,
    colors: ["#C9EF9D", "#49BBA9"],
    reply: "Excellent. You’re officially in charge of sweets 🍰",
  },
  {
    id: "sol",
    name: "Sol Williams",
    initials: "SW",
    note: "a very good person to call",
    lastMessage: "Proud of you, always. Don’t forget that.",
    time: "Yesterday",
    unread: 0,
    online: true,
    colors: ["#FFB5C5", "#E99168"],
    reply: "I mean every word. I’m in your corner.",
  },
];

export const SEED_MESSAGES: Record<string, ChatMessage[]> = {
  nia: [
    {
      id: "nia-1",
      text: "You were right about that tiny bookshop 🌿",
      mine: false,
      time: "8:32",
    },
    {
      id: "nia-2",
      text: "The one tucked behind the flower stand?",
      mine: true,
      time: "8:36",
    },
    {
      id: "nia-3",
      text: "That’s the one. Found a window seat, too.",
      mine: false,
      time: "8:39",
    },
    {
      id: "nia-4",
      text: "Save it for our next slow Saturday.",
      mine: true,
      time: "8:41",
    },
  ],
  theo: [
    {
      id: "theo-1",
      text: "Okay, I finally found the song I was telling you about.",
      mine: false,
      time: "7:10",
    },
    {
      id: "theo-2",
      text: "Send it over. I’m making dinner-playlist material.",
      mine: true,
      time: "7:12",
    },
    {
      id: "theo-3",
      text: "This song feels like that road trip.",
      mine: false,
      time: "7:16",
    },
  ],
  aya: [
    {
      id: "aya-1",
      text: "I took the long way home along the water.",
      mine: false,
      time: "4:58",
    },
    {
      id: "aya-2",
      text: "Was it worth the detour?",
      mine: true,
      time: "5:00",
    },
    {
      id: "aya-3",
      text: "The water was almost lavender tonight.",
      mine: false,
      time: "5:02",
    },
  ],
  luca: [
    {
      id: "luca-1",
      text: "Sunday dinner at mine? No big plan, just good food.",
      mine: false,
      time: "3:19",
    },
    {
      id: "luca-2",
      text: "I’ll bring something sweet.",
      mine: true,
      time: "3:25",
    },
    {
      id: "luca-3",
      text: "I am absolutely bringing dessert.",
      mine: false,
      time: "3:28",
    },
  ],
  sol: [
    {
      id: "sol-1",
      text: "Big day tomorrow. I know you’ve got this.",
      mine: false,
      time: "Yesterday",
    },
    {
      id: "sol-2",
      text: "Needed to hear that. Thank you 💛",
      mine: true,
      time: "Yesterday",
    },
    {
      id: "sol-3",
      text: "Proud of you, always. Don’t forget that.",
      mine: false,
      time: "Yesterday",
    },
  ],
};
