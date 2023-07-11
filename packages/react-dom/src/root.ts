// ReactDOM.createRoot(root).render(<App />);

import {
  createContainer,
  updateContainer,
} from "react-reconciler/src/fiberReconciler";
import { Container } from "./hostConfig";
import { ReactElementType } from "share/ReactTypes";

export function createRoot(container: Container) {
  const root = createContainer(container);

  return {
    render(element: ReactElementType) {
      updateContainer(element, root);
    },
  };
}
