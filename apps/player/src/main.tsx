import { createRoot } from 'react-dom/client'
import '@rublox/runtime/styles.css'
import './player.css'
import { Preview } from './preview.tsx'

const root = document.getElementById('root')
if (root) createRoot(root).render(<Preview />)
