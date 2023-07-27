import { useState } from "react";
import ReactDOM from "react-dom/client";

function App() {
  const [num, setNum] = useState(0);
  return <div onClickCapture={() => setNum(num + 1)}>{num}</div>;
}

function Child() {
  return <span>child</span>;
}

// const App = <div>hello react</div>;
const root = document.querySelector("#root");
ReactDOM.createRoot(root).render(<App />);
