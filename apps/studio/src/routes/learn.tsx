import { createFileRoute } from '@tanstack/react-router'
import { LearnPage } from '../learn/learn-page.tsx'

export const Route = createFileRoute('/learn')({ component: LearnPage })
