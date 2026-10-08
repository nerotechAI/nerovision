import { useEffect, useState } from 'react';
import { continueRender, delayRender } from 'remotion';
// Bundled from node_modules: rendering never depends on a network font service.
import '@fontsource/chakra-petch/400.css';
import '@fontsource/chakra-petch/500.css';
import '@fontsource/chakra-petch/600.css';
import '@fontsource/chakra-petch/700.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';

const FACES = [
  '400 40px "Chakra Petch"',
  '500 40px "Chakra Petch"',
  '600 40px "Chakra Petch"',
  '700 40px "Chakra Petch"',
  '400 20px "IBM Plex Mono"',
  '500 20px "IBM Plex Mono"',
];
// forces the subsets that carry pt-BR accents and typographic punctuation to load as well
const SAMPLE = 'AaÁáÂâÃãÀàÇçÉéÊêÍíÓóÔôÕõÚú—·●';

/** Holds the frame until every font face is ready, so no frame is ever captured with a fallback font. */
export function useFonts(): boolean {
  const [handle] = useState(() => delayRender('Loading fonts'));
  const [ready, setReady] = useState(false);
  useEffect(() => {
    Promise.all(FACES.map((f) => document.fonts.load(f, SAMPLE)))
      .then(() => document.fonts.ready)
      .then(() => {
        setReady(true);
        continueRender(handle);
      })
      .catch((err) => {
        throw new Error(`Font loading failed: ${err}`);
      });
  }, [handle]);
  return ready;
}
