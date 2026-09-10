import { case001Runtime } from './case001';
import { Case3DViewer } from './Case3DViewer';

export function Case3DRoute() {
  return <Case3DViewer manifest={case001Runtime} />;
}
