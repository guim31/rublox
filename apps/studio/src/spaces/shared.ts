import { GraduationCap, House, UsersRound } from 'lucide-react'

export type SpaceKind = 'family' | 'class' | 'team'

export const SPACES_KEY = ['spaces'] as const

export const KIND_ICONS = { family: House, class: GraduationCap, team: UsersRound } as const
