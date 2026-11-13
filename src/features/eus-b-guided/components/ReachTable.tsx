import styles from './eus-b-guided.module.css'

/** What each route reaches. One row per group of targets; both columns always answered. */
export const REACH_ROWS: { target: string; airway: string; esophagus: string }[] = [
  {
    target: 'Stations 2R and 4R',
    airway: 'Yes',
    esophagus: 'Often hidden: the air in the trachea lies in between',
  },
  { target: 'Stations 2L and 4L', airway: 'Yes', esophagus: 'Yes' },
  { target: 'Station 7', airway: 'Yes', esophagus: 'Yes' },
  { target: 'Hilar and interlobar nodes (10, 11)', airway: 'Yes', esophagus: 'No' },
  { target: 'Stations 8 and 9', airway: 'No', esophagus: 'Yes' },
  {
    target: 'Stations 5 and 6',
    airway: 'Not routinely: a great vessel lies in the path',
    esophagus: 'Not routinely: a great vessel lies in the path',
  },
  {
    target: 'Left adrenal gland, left lobe of the liver, nodes at the celiac trunk',
    airway: 'No',
    esophagus: 'Yes, through the gastric wall',
  },
]

export function ReachTable() {
  return (
    <table className={styles.reach} data-reach-table>
      <caption>What each route reaches with the EBUS scope</caption>
      <thead>
        <tr>
          <th scope="col">Target</th>
          <th scope="col">From the airway</th>
          <th scope="col">From the esophagus</th>
        </tr>
      </thead>
      <tbody>
        {REACH_ROWS.map((row) => (
          <tr key={row.target}>
            <th scope="row">{row.target}</th>
            <td>{row.airway}</td>
            <td>{row.esophagus}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
