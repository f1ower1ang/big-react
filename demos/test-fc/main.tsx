import { useState } from "react";
import ReactDOM from "react-dom/client";

// 测试多节点移动
function App1() {
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

// 测试Fragment
function App2() {
  // Fragment包裹其他组件
  const case1 = (
    <>
      <div>1</div>
      <div>2</div>
    </>
  );
  // Fragment与其他组件同级
  const case2 = (
    <ul>
      <>
        <li>1</li>
        <li>2</li>
      </>
      <li>3</li>
      <li>4</li>
    </ul>
  );
  // 数组形式的Fragment
  const arr = [<li>c</li>, <li>d</li>];
  const case3 = (
    <ul>
      <li>a</li>
      <li>b</li>
      {arr}
    </ul>
  );

  return case3;
}

const App = App2;

// const App = <div>hello react</div>;
const root = document.querySelector("#root");
ReactDOM.createRoot(root).render(<App />);
