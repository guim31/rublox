import { messages } from '@rublox/i18n'
import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  costumeOf,
  fitStage,
  joystickStyle,
  knobTransform,
  num,
  sceneTextStyle,
  spriteStyle,
} from '../game/draw.ts'
import { type Renderer, rootAttributes, useExpose } from './types.ts'

/**
 * The game scene: a stage of `sceneWidth × sceneHeight` scene units, scaled to fit and
 * centered. On the editor canvas its children are React elements placed by their x and y;
 * in a running app it exposes its stage (`{ stage }`) and the engine's `World` draws them
 * itself, out of React.
 */
export const GameSceneRenderer: Renderer = (p) => {
  const outer = useRef<HTMLDivElement>(null)
  const [stage, setStage] = useState<HTMLDivElement | null>(null)
  const width = num(p.props.sceneWidth, 360)
  const height = num(p.props.sceneHeight, 640)
  const [box, setBox] = useState({ width, height })
  const running = !p.design
  useExpose(
    p,
    useMemo(() => (stage ? { stage } : null), [stage]),
  )

  useLayoutEffect(() => {
    const element = outer.current
    if (!element) return
    const update = () => setBox({ width: element.clientWidth, height: element.clientHeight })
    update()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(update)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const fit = fitStage(box, { width, height })
  const image =
    typeof p.props.backgroundImage === 'string' && p.props.backgroundImage
      ? p.assetUrl(p.props.backgroundImage)
      : undefined
  return (
    <div
      {...rootAttributes(p, 'GameScene')}
      ref={outer}
      className="rx-scene"
      role="img"
      aria-label={p.name}
      style={{ minHeight: 160, ...p.style }}
    >
      <div
        ref={setStage}
        className="rx-scene-stage"
        data-rx-stage=""
        style={{
          width,
          height,
          transform: `translate(${fit.x}px, ${fit.y}px) scale(${fit.scale})`,
          backgroundImage: image ? `url(${JSON.stringify(image)})` : undefined,
        }}
      >
        {running ? null : p.children}
      </div>
    </div>
  )
}

export const SpriteRenderer: Renderer = (p) => {
  const costume = costumeOf(p.props, p.assetUrl)
  const box = spriteStyle(p.props)
  return (
    <div
      {...rootAttributes(p, 'Sprite')}
      className="rx-body rx-body-Sprite"
      style={{ ...p.style, ...box }}
    >
      {costume?.kind === 'image' ? (
        <img src={costume.src} alt="" draggable={false} />
      ) : costume ? (
        <span>{costume.text}</span>
      ) : (
        <span
          className="rx-body-empty"
          role="img"
          aria-label={messages[p.locale].runtime.imagePlaceholder}
        />
      )}
    </div>
  )
}

export const SceneTextRenderer: Renderer = (p) => (
  <div
    {...rootAttributes(p, 'SceneText')}
    className="rx-body rx-body-SceneText"
    style={{ ...p.style, ...(sceneTextStyle(p.props) as React.CSSProperties) }}
  >
    {String(p.props.text ?? '')}
  </div>
)

export const JoystickRenderer: Renderer = (p) => (
  <div
    {...rootAttributes(p, 'Joystick')}
    className="rx-body rx-body-Joystick"
    style={{ ...p.style, ...joystickStyle(p.props) }}
  >
    <div className="rx-joystick-knob" style={{ transform: knobTransform(p.props) }} />
  </div>
)
