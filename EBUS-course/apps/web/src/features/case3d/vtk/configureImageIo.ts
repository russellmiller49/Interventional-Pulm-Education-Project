import { setPipelinesBaseUrl as setImageIoPipelinesBaseUrl } from '@itk-wasm/image-io';
import { setPipelinesBaseUrl as setItkWasmPipelinesBaseUrl } from 'itk-wasm';

let configured = false;

function getPipelinesBaseUrl() {
  return new URL(`${import.meta.env.BASE_URL}pipelines`, window.location.origin).href.replace(/\/$/, '');
}

export function configureImageIo() {
  if (configured || typeof window === 'undefined') {
    return;
  }

  const pipelinesBaseUrl = getPipelinesBaseUrl();
  setImageIoPipelinesBaseUrl(pipelinesBaseUrl);
  setItkWasmPipelinesBaseUrl(pipelinesBaseUrl);
  configured = true;
}
