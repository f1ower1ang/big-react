import { useState } from "react";
import ReactDOM from "react-dom/client";

function App() {
  const [num, setNum] = useState(0);
  const arr =
    num % 2 === 0
      ? [<li key="1">1</li>, <li key="2">2</li>, <li key="3">3</li>]
      : [<li key="3">3</li>, <li key="2">2</li>, <li key="1">1</li>];
  return (
    <div
      onClick={(e) => {
        console.log(e.target);
        setNum(num + 1);
      }}
    >
      <ul>{arr}</ul>
    </div>
  );
}

function Child() {
  return <span>child</span>;
}

// const App = <div>hello react</div>;
const root = document.querySelector("#root");
ReactDOM.createRoot(root).render(<App />);
