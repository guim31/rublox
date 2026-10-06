import { type Browser, expect, type Page, test } from '@playwright/test'
import { ADMIN, addComponent, usePrefs } from './helpers.ts'

/**
 * PR screenshots of J1 (SPEC § 7): Junior and Studio, light and dark. `pnpm screenshots`
 * writes them to docs/screenshots/j1/.
 */
const DIR = 'docs/screenshots/j1'

type Prefs = { mode: 'junior' | 'studio'; theme: 'light' | 'dark' }

async function open(browser: Browser, prefs: Prefs): Promise<Page> {
  const context = await browser.newContext({
    locale: 'fr-FR',
    viewport: { width: 1440, height: 900 },
  })
  const page = await context.newPage()
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await usePrefs(page, { ...prefs, locale: 'fr' })
  return page
}

/** Calls the API from the page's context (its cookies), as the studio does. */
async function api(page: Page, method: 'POST' | 'PATCH', path: string, data: unknown) {
  const origin = new URL(
    page.url() === 'about:blank' ? '/' : page.url(),
    test.info().project.use.baseURL,
  ).origin
  const response = await page.request.fetch(path, { method, data, headers: { origin } })
  expect(response.ok(), `${method} ${path}`).toBe(true)
  return response.json()
}

async function project(page: Page, name: string, components: string[]) {
  await page.goto('/')
  await page
    .getByRole('button', { name: /Nouveau projet|C’est parti/ })
    .first()
    .click()
  await page.getByRole('dialog').getByRole('textbox').fill(name)
  await page.getByRole('dialog').getByRole('button', { name: 'Créer' }).click()
  await page.waitForURL(/\/p\/[^/]+/)
  for (const type of components) await addComponent(page, type)
  await expect(page.getByTestId('save-state')).toHaveAttribute('data-state', 'saved')
}

const VARIANTS = [
  ['junior', 'light'],
  ['junior', 'dark'],
  ['studio', 'light'],
  ['studio', 'dark'],
] as const

for (const [index, [mode, theme]] of VARIANTS.entries()) {
  test(`${mode} ${theme}`, async ({ browser }) => {
    const prefs = { mode, theme }
    // Readable usernames in the pictures (camille, lou, sacha), unique on the shared server.
    const suffix = index === 0 ? '' : String(index + 1)
    const admin = await open(browser, prefs)
    await admin.goto('/login')
    await api(admin, 'POST', '/api/auth/sign-in/username', ADMIN)
    const { code } = await api(admin, 'POST', '/api/invites', { note: 'Camille' })

    if (mode === 'junior' && theme === 'light') {
      await admin.context().clearCookies()
      await admin.goto('/login')
      await admin.screenshot({ path: `${DIR}/login.png` })
      await admin.goto(`/invite/${code}`)
      await expect(admin.getByRole('heading', { name: 'Bienvenue sur Rublox' })).toBeVisible()
      await admin.getByLabel('Ton nom').fill('Camille Martin')
      await admin.screenshot({ path: `${DIR}/invite.png` })
      await admin.goto('/login')
      await api(admin, 'POST', '/api/auth/sign-in/username', ADMIN)
    }

    // A parent, their family, two children with avatars and projects.
    const parent = await open(browser, prefs)
    await parent.goto('/login')
    await api(parent, 'POST', '/api/invites/accept', {
      code,
      username: `camille${suffix}`,
      displayName: 'Camille',
      password: 'camille-password',
    })
    await api(parent, 'PATCH', '/api/me', { avatar: 'fox', uiMode: mode, theme })
    const { id: spaceId } = await api(parent, 'POST', '/api/spaces', {
      name: 'Famille Martin',
      kind: 'family',
    })
    const children = [
      { name: 'Lou', avatar: 'bunny', projects: [['Le dé magique', ['Text', 'Button']]] },
      {
        name: 'Sacha',
        avatar: 'robot',
        projects: [['Ma liste de courses', ['TextInput', 'Button', 'Text']]],
      },
    ] as const
    for (const child of children) {
      const username = `${child.name.toLowerCase()}${suffix}`
      await api(parent, 'POST', `/api/spaces/${spaceId}/accounts`, {
        username,
        displayName: child.name,
        password: 'child-password',
      })
      const page = await open(browser, prefs)
      await page.goto('/login')
      await api(page, 'POST', '/api/auth/sign-in/username', {
        username,
        password: 'child-password',
      })
      await api(page, 'PATCH', '/api/me', { avatar: child.avatar, uiMode: mode, theme })
      for (const [name, components] of child.projects) await project(page, name, [...components])
      await page.context().close()
    }
    await project(parent, 'Quiz des capitales', ['Text', 'Image', 'Button'])

    await parent.goto('/')
    await expect(parent.getByRole('button', { name: 'Ouvrir Le dé magique' })).toBeVisible()
    await parent.mouse.move(0, 0)
    await parent.waitForTimeout(300)
    await parent.screenshot({ path: `${DIR}/${mode}-${theme}-dashboard.png` })

    await parent.goto(`/spaces/${spaceId}`)
    await expect(parent.getByText('Sacha').first()).toBeVisible()
    await parent.screenshot({ path: `${DIR}/${mode}-${theme}-space.png` })
    await parent.getByRole('radio', { name: 'Projets' }).click()
    await expect(parent.getByRole('link', { name: 'Le dé magique' })).toBeVisible()
    await parent.waitForTimeout(300)
    await parent.screenshot({ path: `${DIR}/${mode}-${theme}-space-projects.png` })

    await parent.getByRole('link', { name: 'Le dé magique' }).click()
    await expect(parent.getByText(/Tu regardes le projet de Lou/)).toBeVisible()
    await parent.waitForTimeout(500)
    await parent.screenshot({ path: `${DIR}/${mode}-${theme}-read-only.png` })

    await parent.goto('/account')
    await expect(parent.getByRole('heading', { name: 'Mon compte' })).toBeVisible()
    await parent.screenshot({ path: `${DIR}/${mode}-${theme}-account.png`, fullPage: true })

    await admin.goto('/admin')
    await expect(admin.getByText('Sacha').first()).toBeVisible()
    await admin.waitForTimeout(300)
    await admin.screenshot({ path: `${DIR}/${mode}-${theme}-admin.png` })
  })
}
