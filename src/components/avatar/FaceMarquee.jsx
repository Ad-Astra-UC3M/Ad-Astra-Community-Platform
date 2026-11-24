"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";

const faces = Array.from({ length: 10 }, (_, index) => `/brand/avatar-studio/face-${index + 1}.png`);

// La tira original de Avatar Studio se pausa al salir de pantalla, al recibir foco o con su botón.
export default function FaceMarquee() {
  const rootRef = useRef(null);
  const [paused, setPaused] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!("IntersectionObserver" in window)) {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting));
    observer.observe(rootRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <figure ref={rootRef} className="group/parade relative min-w-0" data-paused={paused || !visible}>
      <div
        className="group/window w-full overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)] focus-visible:outline-2 focus-visible:-outline-offset-3 motion-reduce:overflow-x-auto motion-reduce:[mask-image:none]"
        tabIndex={0}
        role="group"
        aria-label="Ejemplos de avatares Ad Astra"
      >
        <div
          className="flex w-max motion-safe:animate-[avatar-face-parade_46s_linear_infinite] group-data-[paused=true]/parade:[animation-play-state:paused] group-hover/window:[animation-play-state:paused] group-focus/window:[animation-play-state:paused]"
          aria-hidden="true"
        >
          {[0, 1].map((copy) => (
            <div key={copy} className={`flex shrink-0 items-center gap-3 py-2 pr-3 ${copy ? "motion-reduce:hidden" : ""}`}>
              {faces.map((src, index) => (
                <img
                  key={src}
                  src={src}
                  alt=""
                  width="256"
                  height="256"
                  loading="lazy"
                  decoding="async"
                  draggable="false"
                  className="block size-[104px] shrink-0 rotate-(--face-tilt) object-contain select-none lg:size-[132px]"
                  style={{ "--face-tilt": `${(index % 3 - 1) * 4}deg` }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      <figcaption className="mt-2 min-h-11 content-center pr-11 text-sm leading-6 sm:text-base motion-reduce:min-h-0 motion-reduce:pr-0">
        Muchas caras. Un mismo universo.
      </figcaption>
      <button
        type="button"
        className="absolute right-0 bottom-0 inline-flex size-11 cursor-pointer items-center justify-center rounded-full text-brand-ink hover:bg-brand-soft/35 focus-visible:outline-2 focus-visible:-outline-offset-3 motion-reduce:hidden"
        aria-label="Pausar animación de caras"
        aria-pressed={paused}
        onClick={() => setPaused((value) => !value)}
      >
        {paused ? <Play size={15} aria-hidden="true" /> : <Pause size={15} aria-hidden="true" />}
      </button>
    </figure>
  );
}
