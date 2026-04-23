import Lock from "./lock";
import { setTimeout as wait } from "timers/promises";

async function main() {
  const st = performance.now();
  console.log("started at", st);
  
  setTimeout(async () => {
    const l = new Lock("test");
    console.log("started 1", performance.now());
    await l.lock();
    console.log("locked 1", performance.now());
    
    await wait(3000);
    
    console.log("done 1", performance.now());
    l.release();
  }, 3000);
  
  setTimeout(async () => {
    const l = new Lock("test");
    console.log("started 2", performance.now());
    await l.lock();
    console.log("locked 2", performance.now());
    
    await wait(4000);
    
    console.log("done 2", performance.now());
    l.release();
  }, 2000);
  
  setTimeout(async () => {
    const l = new Lock("test");
    console.log("started 3", performance.now());
    await l.lock();
    console.log("locked 3", performance.now());

    await wait(6000);

    console.log("done 3", performance.now());
    l.release();
  }, 1000);

  await wait(20 * 1000);
}

main()
  .then(() => console.log("done"))
  .catch(() => console.log("error"));
