import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const FROZEN_PRODUCTION_SHA = '2f26cb7632fe4e8f6835a8528458b672e8f360c2'

const frozenFiles = {
  'src/features/cardiohelp-ecmo/components/teaching/drills/StartupSensorOrientationPanel.tsx':
    'dc65b3c5c85c4f2b55653e1cfd73b756b7528d18891a976eff7a96b439873278',
  'src/features/cardiohelp-ecmo/components/teaching/drills/PreloadDrainageCollapsePanel.tsx':
    'fdac41e48bd5d47588d401f119d5ec6a95f745ce142cde64b9493aa79f4ba21a',
  'src/features/cardiohelp-ecmo/components/teaching/drills/VvRecirculationPanel.tsx':
    'c70f0a47dc4dd82607ecc9b5a988675498ed44deef410116a106a53829cea5a8',
  'src/features/cardiohelp-ecmo/components/teaching/drills/GasSourceInterruptionPanel.tsx':
    'efdbeea5a644768df3d14a75354864cfa397d40186cd5d60e2313032d1ff0757',
  'src/features/cardiohelp-ecmo/components/teaching/drills/ArterialBubbleStopPanel.tsx':
    'c1ddbd29e484ba9c6f12e9ae9271e95bd89d5f40285dfa5c2e91d1e34528ee01',
  'src/features/cardiohelp-ecmo/components/teaching/drills/VaDifferentialHypoxemiaPanel.tsx':
    '67bc66cf40e404fc3983f41e63bd0da7b45691f46b3f13c5688190ff21b3ef14',
  'src/features/cardiohelp-ecmo/content/learnLessons.ts':
    '8b3890748c94399788c8c3ee3a4f86f2b77f9a8183c1c516870b82c79ccacfbd',
  'src/features/cardiohelp-ecmo/content/learnPredictionItems.ts':
    'f094fce4bbec9267e1429c1288e32100ba5e277b136104b08b83bc551886490b',
  'src/features/cardiohelp-ecmo/content/clinicalCases.ts':
    '85571569edc8ecae1c54d350ae6ac820b725d00491e2b4c5abdaa1228e55683d',
  'src/app/[locale]/cardiohelp-ecmo/practice/page.tsx':
    'e9940ac427b39deaa86710fa411d8f0b4172a283f40d7095b06cf65cf313dbf0',
  'src/app/[locale]/cardiohelp-ecmo/assess/page.tsx':
    'c1aaae509869b131be78d7ad57602cacb7457137f172a8ecd0cb700550d7589c',
  'src/features/cardiohelp-ecmo/engine/progress.ts':
    'c436121aad538b6a33e6396b194e4a4505e6acbc47ea68fe2a92e44654cadb3f',
  'src/features/cardiohelp-ecmo/engine/reducer.ts':
    'f5cb36fc25d3fa373ee1ef2b8d304effa19e85f86bdfc54989fde1730bedd153',
  'src/features/cardiohelp-ecmo/engine/simulation.ts':
    'f9237f2d6648da696bcca614868daae0c76cec24fe7e91134c0caff7a819c79e',
  'src/features/cardiohelp-ecmo/content/scenarios.ts':
    '5361145ee1d0a41e6e67f30f68b28596c93b25354a8710663afa38325452c20b',
  'src/features/cardiohelp-ecmo/content/referenceProfiles.ts':
    'b044c7707447da07f821e06c52a22c1e4c21c1b850cf33d22036fcfd46a5c703',
  'src/features/cardiohelp-ecmo/components/PracticeCasePlayer.tsx':
    '558a4c85661a62b846513891d93208dc08668cb90b41ff3cb842e2627aa978ed',
  'src/features/cardiohelp-ecmo/components/CardiohelpModuleNav.tsx':
    '354b0a8f2c3f18df50d6aa3bedfbaf5ad9608260b683a40f258c661dc7f071c5',
  'src/features/cardiohelp-ecmo/content/curriculum.ts':
    'f60c416c610d29fe653e4cd33bd862c369394ebc58aab024c224443de50c1142',
  'src/app/[locale]/cardiohelp-ecmo/page.tsx':
    'ba7a757d51ebb9da6af5ea0e595e2e0749b8e16e24e11255f84899c9f644e8c2',
  'src/app/[locale]/cardiohelp-ecmo/learn/page.tsx':
    'bc1073c07b1f684f6c493fc7639d72100adaa0b2c88729dee56a25b6b5bea251',
  'src/features/critical-care/content/modules.ts':
    '412b0582f3d584fd7c900a1b683c090d711bd75eed5a1478e71d120243559554',
  'src/features/critical-care/content/activities.ts':
    '51acfb70880e415122df5924f1d7e4f2dd21c9d04bf382509d441c418996f083',
  'src/features/critical-care/content/publicVisibility.ts':
    '03055ed541237d1e550d5259a2cf20d5b0ad10236e72e14c3c989a2633bf7607',
  'src/features/cardiohelp-ecmo/content/deviceProfile.ts':
    '66ae1de4572318d4b22105ff1bbfb9105a2fd2bf0b94879b6ad8f5703d72a8a3',
  'src/features/cardiohelp-ecmo/engine/types.ts':
    'c7ab36e3490bb51eaa40f6e443ccb700bf1c1120722728d8bfa727541be1d91e',
  'src/features/learning-module/moduleRoutes.ts':
    'c2c82828c5a0a094232b3b33877be02b2cb3cefd0913eb6ed9753028c7207d68',
  'src/features/cardiohelp-ecmo/components/CardiohelpWorkbench.tsx':
    '37dc2293cc32ffb52d5a3e7f51cbd7a0f802def843265b04ae3764f98ae14f3e',
} as const

function sha256(path: string): string {
  return createHash('sha256')
    .update(readFileSync(resolve(process.cwd(), path)))
    .digest('hex')
}

describe(`B6 frozen human-test contract at ${FROZEN_PRODUCTION_SHA}`, () => {
  it.each(Object.entries(frozenFiles))('preserves %s byte-for-byte', (path, expectedHash) => {
    expect(sha256(path)).toBe(expectedHash)
  })

  it('pins a reviewable set of protected surfaces rather than a self-updating snapshot', () => {
    expect(Object.keys(frozenFiles)).toHaveLength(28)
    expect(FROZEN_PRODUCTION_SHA).toMatch(/^[0-9a-f]{40}$/)
  })
})
