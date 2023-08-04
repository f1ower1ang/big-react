import { useState, useEffect } from "react";
// import ReactDOM from "react-dom/client";
import ReactDOM from "react-noop-renderer";

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

// 测试Fragment
function App2() {
  const [num, setNum] = useState(0);
  // Fragment包裹其他组件
  const case1 = (
    <>
      <div>1</div>
      <div>2</div>
    </>
  );
  // Fragment与其他组件同级
  const case2 = (
    <ul onClick={() => setNum(num + 1)}>
      {num % 2 === 0 ? (
        case1
      ) : (
        <>
          <li>1</li>
          <li>2</li>
        </>
      )}
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

  return case2;
}

// 批处理调度
function App3() {
  const [num, setNum] = useState(0);
  const [count, setCount] = useState(0);
  return (
    <div
      onClick={() => {
        setNum((num) => num + 1);
        setNum((num) => num + 1);
        setNum((num) => num + 1);
        setCount((c) => c + 1);
        setCount((c) => c + 1);
      }}
    >
      {num}-{count}
    </div>
  );
}

// useEffect
function App4() {
  const [num, setNum] = useState(0);
  useEffect(() => {
    console.log("App mount");
  }, []);
  useEffect(() => {
    console.log("num change create", num);
    return () => {
      console.log("num change destroy", num);
    };
  }, [num]);
  return (
    <div onClick={() => setNum(num + 1)}>
      {num % 2 === 0 ? <Child4 /> : num}
    </div>
  );
}
function Child4() {
  useEffect(() => {
    console.log("Child mount");
    return () => {
      console.log("Child unmount");
    };
  }, []);
  return "i am child";
}

// const App = App4;

// const root = document.querySelector("#root");
// ReactDOM.createRoot(root).render(<App />);

function App() {
  return (
    <>
      <Child />
      <div>hello, world</div>
    </>
  );
}
function Child() {
  return "child";
}
const root = ReactDOM.createRoot();
root.render(<App />);
window.root = root;
