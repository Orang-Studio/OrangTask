// shared list-icon registry used by the Sidebar, the Lists index, and the list editors icon picker
import {
  Hash, Inbox, Briefcase, Home, Star, Heart, ShoppingCart, Webhook,
  List, ListChecks, Calendar, BookOpen, Code, Music, Camera, Coffee,
  Zap, Flag, Bell, Bookmark, Folder, FileText, Tag, DollarSign,
  Gift, Plane, Car, Dumbbell, GraduationCap, Lightbulb, Leaf, Sun,
  Moon, Cloud, Pizza, Gamepad2, Wrench, Palette, Target, Trophy,
  Users, Phone, Mail, MapPin, Shield, Smile, PawPrint, Rocket,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export const LIST_ICONS: Record<string, LucideIcon> = {
  hash: Hash, inbox: Inbox, briefcase: Briefcase, home: Home, star: Star,
  heart: Heart, cart: ShoppingCart, list: List, checks: ListChecks,
  calendar: Calendar, book: BookOpen, code: Code, music: Music,
  camera: Camera, coffee: Coffee, zap: Zap, flag: Flag, bell: Bell,
  bookmark: Bookmark, folder: Folder, file: FileText, tag: Tag,
  dollar: DollarSign, gift: Gift, plane: Plane, car: Car,
  dumbbell: Dumbbell, graduation: GraduationCap, lightbulb: Lightbulb,
  leaf: Leaf, sun: Sun, moon: Moon, cloud: Cloud, pizza: Pizza,
  game: Gamepad2, wrench: Wrench, palette: Palette, target: Target,
  trophy: Trophy, users: Users, phone: Phone, mail: Mail, map: MapPin,
  shield: Shield, smile: Smile, paw: PawPrint, rocket: Rocket,
  webhook: Webhook,
}

// stable display order for the picker
export const LIST_ICON_KEYS = Object.keys(LIST_ICONS)

// default icon for newly created lists, so a fresh list and one explicitly set to this icon look
export const DEFAULT_LIST_ICON = 'list'

export function ListIcon({
  icon,
  color,
  size = 18,
}: {
  icon?: string | null
  color?: string | null
  size?: number
}) {
  const Icon = (icon && LIST_ICONS[icon]) || LIST_ICONS[DEFAULT_LIST_ICON]
  return <Icon size={size} style={{ color: color || undefined }} className={color ? '' : 'text-gray-400'} />
}
