export type NavColor =
  | "blue"
  | "green"
  | "orange"
  | "yellow"
  | "purple"
  | "cyan"
  | "indigo"
  | "teal"
  | "pink";

export const COLOR_CLASSES: Record<
  NavColor,
  { bar: string; icon: string; border: string; borderMuted: string; text: string }
> = {
  blue: {
    bar: "bg-blue-500",
    icon: "text-primary-blue",
    border: "border-blue-500",
    borderMuted: "border-blue-500/40",
    text: "text-blue-400",
  },
  green: {
    bar: "bg-green-500",
    icon: "text-primary-green",
    border: "border-green-500",
    borderMuted: "border-green-500/40",
    text: "text-green-400",
  },
  orange: {
    bar: "bg-orange-500",
    icon: "text-orange-500",
    border: "border-orange-500",
    borderMuted: "border-orange-500/40",
    text: "text-orange-400",
  },
  yellow: {
    bar: "bg-yellow-500",
    icon: "text-yellow-500",
    border: "border-yellow-500",
    borderMuted: "border-yellow-500/40",
    text: "text-yellow-400",
  },
  purple: {
    bar: "bg-purple-500",
    icon: "text-primary-purple",
    border: "border-purple-500",
    borderMuted: "border-purple-500/40",
    text: "text-purple-400",
  },
  cyan: {
    bar: "bg-cyan-500",
    icon: "text-primary-cyan",
    border: "border-cyan-500",
    borderMuted: "border-cyan-500/40",
    text: "text-cyan-400",
  },
  indigo: {
    bar: "bg-indigo-500",
    icon: "text-indigo-500",
    border: "border-indigo-500",
    borderMuted: "border-indigo-500/40",
    text: "text-indigo-400",
  },
  teal: {
    bar: "bg-teal-500",
    icon: "text-teal-500",
    border: "border-teal-500",
    borderMuted: "border-teal-500/40",
    text: "text-teal-400",
  },
  pink: {
    bar: "bg-pink-500",
    icon: "text-pink-500",
    border: "border-pink-500",
    borderMuted: "border-pink-500/40",
    text: "text-pink-400",
  },
};
