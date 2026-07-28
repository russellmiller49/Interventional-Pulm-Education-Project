import styles from './learning-module-v2.module.css'

export function SaveExitControl({ onSaveAndExit }: { readonly onSaveAndExit: () => void }) {
  return (
    <button type="button" className={styles.primaryButton} onClick={onSaveAndExit}>
      Save &amp; exit
    </button>
  )
}
