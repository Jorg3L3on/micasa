'use client';

import Link from 'next/link';
import {
  Fragment,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type MouseEvent,
} from 'react';

import type { HeroEngine } from '@/components/landing/hero-engine';
import {
  fractionForScene,
  pinFraction,
  progressFromFraction,
  sceneFromProgress,
} from '@/components/landing/hero-scroll';
import { SCENES, STILL_SCENE } from '@/components/landing/landing-data';

const H1_LABEL = 'El mes se parte en dos. MiCasa planea tu dinero por quincenas.';

const REDUCED_QUERY = '(prefers-reduced-motion: reduce)';

const subscribeReduced = (onChange: () => void) => {
  const media = window.matchMedia(REDUCED_QUERY);
  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
};
const getReduced = () => window.matchMedia(REDUCED_QUERY).matches;

/** From `md` up the hero pins and the scroll drives the story. */
const WIDE_QUERY = '(min-width: 768px)';

const subscribeWide = (onChange: () => void) => {
  const media = window.matchMedia(WIDE_QUERY);
  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
};
const getWide = () => window.matchMedia(WIDE_QUERY).matches;
const getServerFalse = () => false;

type EngineState = 'idle' | 'on' | 'failed';

/** Where the sticky hero is inside its tall wrapper. */
const measurePin = (wrap: HTMLElement | null, hero: HTMLElement | null) => {
  if (!wrap || !hero) return null;
  const rect = wrap.getBoundingClientRect();
  const heroHeight = hero.offsetHeight;
  const stickyTop = parseFloat(getComputedStyle(hero).top) || 0;
  return {
    fraction: pinFraction(rect.top, rect.height, heroHeight, stickyTop),
    /** Scroll distance of the whole pin. */
    distance: Math.max(0, rect.height - heroHeight),
    /** How far the page has scrolled into the pin (negative before it). */
    offset: stickyTop - rect.top,
  };
};
type SceneState = { act: number | null; prev: number };

/**
 * Hero: headline, sublines and controls are plain HTML and paint first. The
 * particle engine loads in its own chunk afterwards and draws behind them.
 * From `md` up with motion allowed the hero pins and the scroll drives the
 * scenes; phones autoplay on a timer. Reduced motion rests on scene 3; without
 * WebGL the still of scene 3 shows.
 */
export const LandingHero = () => {
  const reduced = useSyncExternalStore(subscribeReduced, getReduced, getServerFalse);
  const wide = useSyncExternalStore(subscribeWide, getWide, getServerFalse);

  const [scene, setScene] = useState<SceneState>({ act: null, prev: -1 });
  const [playing, setPlaying] = useState(true);
  const [engineState, setEngineState] = useState<EngineState>('idle');

  const wrapRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLElement>(null);
  const glRef = useRef<HTMLCanvasElement>(null);
  const labelRef = useRef<HTMLCanvasElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<HeroEngine | null>(null);

  const failed = engineState === 'failed';
  const scrollDriven = wide && !reduced && !failed;
  const restScene = reduced || failed ? STILL_SCENE : 0;
  const act = scene.act ?? restScene;

  const showScene = (next: number) => {
    setScene((current) => {
      const shown = current.act ?? restScene;
      return shown === next ? current : { act: next, prev: shown };
    });
  };
  const showSceneRef = useRef(showScene);
  const playingRef = useRef(playing);
  useEffect(() => {
    showSceneRef.current = showScene;
    playingRef.current = playing;
  });

  // Load the engine after first paint, in its own chunk.
  useEffect(() => {
    let cancelled = false;
    let engine: HeroEngine | null = null;

    const fail = () => {
      if (cancelled) return;
      engineRef.current = null;
      setEngineState('failed');
      setScene({ act: STILL_SCENE, prev: -1 });
    };

    const start = async () => {
      const gl = glRef.current;
      const labels = labelRef.current;
      const text = textRef.current;
      const rail = railRef.current;
      if (!gl || !labels || !text || !rail) return;
      try {
        const { createHeroEngine } = await import('@/components/landing/hero-engine');
        if (cancelled) return;
        engine = createHeroEngine({
          glCanvas: gl,
          labelCanvas: labels,
          textEl: text,
          railEl: rail,
          reduced,
          onScene: (next) => showSceneRef.current(next),
          onLost: fail,
        });
        if (!engine) {
          fail();
          return;
        }
        engineRef.current = engine;
        engine.setPlaying(playingRef.current);
        setEngineState('on');
      } catch {
        fail();
      }
    };

    const timer = window.setTimeout(start, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      engine?.destroy();
      engineRef.current = null;
    };
  }, [reduced]);

  // Scroll-driven story: the pinned hero's travel sets the scene progress.
  useEffect(() => {
    if (!scrollDriven) {
      engineRef.current?.setScroll(null);
      return;
    }
    let raf = 0;
    const read = () => {
      raf = 0;
      const pin = measurePin(wrapRef.current, heroRef.current);
      if (!pin) return;
      const progress = progressFromFraction(pin.fraction);
      engineRef.current?.setScroll(progress);
      showSceneRef.current(sceneFromProgress(progress));
    };
    const queue = () => {
      if (!raf) raf = requestAnimationFrame(read);
    };
    queue();
    window.addEventListener('scroll', queue, { passive: true });
    window.addEventListener('resize', queue);
    return () => {
      window.removeEventListener('scroll', queue);
      window.removeEventListener('resize', queue);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [scrollDriven, engineState]);

  const handlePick = (index: number) => {
    if (scrollDriven) {
      const pin = measurePin(wrapRef.current, heroRef.current);
      if (!pin) return;
      window.scrollTo({
        top: window.scrollY - pin.offset + fractionForScene(index) * pin.distance,
        behavior: 'smooth',
      });
      return;
    }
    engineRef.current?.goTo(index);
    showScene(index);
  };

  const handleTogglePlay = () => {
    const next = !playing;
    setPlaying(next);
    engineRef.current?.setPlaying(next);
    // One control stops every motion that runs by itself: the engine's
    // ambient clock, the orbs and the word band below the hero.
    heroRef.current?.closest('.mc-root')?.toggleAttribute('data-paused', !next);
  };

  const handleMouseMove = (event: MouseEvent<HTMLElement>) => {
    const engine = engineRef.current;
    if (!engine) return;
    const rect = event.currentTarget.getBoundingClientRect();
    engine.setPointer(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -(((event.clientY - rect.top) / rect.height) * 2 - 1),
      true,
    );
  };

  const handleMouseLeave = () => {
    engineRef.current?.setPointer(0, 0, false);
  };

  return (
    <div ref={wrapRef} className="mc-hero-wrap" data-still={failed ? 'true' : undefined}>
      <section
        ref={heroRef}
        id="inicio"
        className="mc-hero"
        data-engine={engineState === 'on' ? 'on' : 'off'}
        data-still={failed ? 'true' : undefined}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <div className="mc-orb mc-orb-a" aria-hidden="true" />
        <div className="mc-orb mc-orb-b" aria-hidden="true" />
        <div className="mc-layer mc-still" aria-hidden="true" />
        <canvas ref={glRef} className="mc-layer mc-canvas" aria-hidden="true" />
        <div className="mc-layer mc-hero-shade" aria-hidden="true" />
        <canvas ref={labelRef} className="mc-layer mc-canvas mc-lb" aria-hidden="true" />

        <div ref={textRef} className="mc-hero-text">
          <p className="mc-eyebrow mc-rise">Planeación por quincenas · hecho para México</p>
          <h1 className="mc-h1" aria-label={H1_LABEL}>
            {SCENES.map((item, index) => (
              <span
                key={item.label}
                className="mc-head"
                aria-hidden="true"
                data-state={index === act ? 'on' : index === scene.prev ? 'leaving' : 'off'}
              >
                {item.words.map((word, wordIndex) => (
                  <Fragment key={`${word}-${wordIndex}`}>
                    {wordIndex > 0 ? ' ' : null}
                    <span
                      className={
                        wordIndex >= item.highlightFrom ? 'mc-word mc-word-hi' : 'mc-word'
                      }
                      style={{ '--i': wordIndex } as CSSProperties}
                    >
                      {word}
                    </span>
                  </Fragment>
                ))}
              </span>
            ))}
          </h1>
          <div className="mc-subs">
            {SCENES.map((item, index) => (
              <p
                key={item.label}
                className="mc-sub"
                data-on={index === act}
                aria-hidden={index !== act}
              >
                {item.subline}
              </p>
            ))}
          </div>
        </div>

        <div ref={railRef} className="mc-rail">
          <div className="mc-rail-actions mc-rise">
            <Link href="/register" className="mc-cta mc-cta-glow">
              Crear cuenta gratis
            </Link>
            <a href="#producto" className="mc-ghost mc-hide-sm">
              Ver el producto
            </a>
          </div>
          <div className="mc-scenes">
            <button
              type="button"
              className="mc-play"
              onClick={handleTogglePlay}
              aria-label={playing ? 'Pausar la animación' : 'Reproducir la animación'}
            >
              {playing ? (
                <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
                  <path
                    d="M4 2.5v11M12 2.5v11"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.6"
                    strokeLinecap="round"
                  />
                </svg>
              ) : (
                <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
                  <path d="M4.5 2.5l8.5 5.5-8.5 5.5z" fill="currentColor" />
                </svg>
              )}
            </button>
            <div className="mc-scene-list" role="group" aria-label="Escenas">
              {SCENES.map((item, index) => (
                <button
                  key={item.label}
                  type="button"
                  className="mc-scene"
                  onClick={() => handlePick(index)}
                  aria-pressed={index === act}
                  aria-label={`Escena ${index + 1}: ${item.label}`}
                >
                  <span className="mc-scene-n">0{index + 1}</span>
                  <span className="mc-scene-label">{item.label}</span>
                  <span className="mc-scene-track" aria-hidden="true">
                    <span
                      className="mc-scene-fill"
                      style={{
                        width: index <= act ? '100%' : '0%',
                        transitionDuration: scrollDriven
                          ? '300ms'
                          : index === act && playing && engineState === 'on' && !reduced
                            ? `${item.progressMs}ms`
                            : '0ms',
                      }}
                    />
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <ol className="mc-sr">
          {SCENES.map((item) => (
            <li key={item.label}>
              {item.words.join(' ')} {item.subline}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
};
