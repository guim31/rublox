import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { create } from 'zustand'
import { Button } from '../../components/ui/button.tsx'
import { Dialog } from '../../components/ui/dialog.tsx'
import { Input } from '../../components/ui/input.tsx'

type PromptState = {
  request: { message: string; value: string; resolve: (value: string | null) => void } | null
}

const usePrompt = create<PromptState>()(() => ({ request: null }))

/** Replaces `window.prompt` for Blockly (new variable, rename…). */
export function askName(message: string, value: string): Promise<string | null> {
  return new Promise((resolve) => usePrompt.setState({ request: { message, value, resolve } }))
}

export function PromptDialog() {
  const { t } = useTranslation()
  const request = usePrompt((s) => s.request)
  const [value, setValue] = useState('')
  useEffect(() => setValue(request?.value ?? ''), [request])
  const close = (result: string | null) => {
    request?.resolve(result)
    usePrompt.setState({ request: null })
  }
  return (
    <Dialog
      open={request !== null}
      onOpenChange={(open) => !open && close(null)}
      title={request?.message ?? ''}
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault()
          close(value.trim() || null)
        }}
      >
        <Input
          autoFocus
          value={value}
          onChange={(event) => setValue(event.target.value)}
          aria-label={request?.message ?? ''}
        />
        <div className="flex justify-end gap-2">
          <Button onClick={() => close(null)}>{t('common.cancel')}</Button>
          <Button type="submit" variant="primary" disabled={!value.trim()}>
            {t('common.save')}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
