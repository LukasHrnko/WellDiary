import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Register FontAwesome as global icons
import { library } from "@fortawesome/fontawesome-svg-core";
import { 
  faThLarge, faBook, faHeart, faLightbulb, faTrophy, faCog, faBars,
  faBell, faChevronLeft, faChevronRight, faCloudUploadAlt, faMoon,
  faWalking, faBrain, faArrowUp, faArrowDown, faEllipsisH, faMedal,
  faLock, faTimes, faClock, faMobile, faCoffee, faFire, faSun, faUsers,
  faAppleAlt, faCheck
} from "@fortawesome/free-solid-svg-icons";

library.add(
  faThLarge, faBook, faHeart, faLightbulb, faTrophy, faCog, faBars,
  faBell, faChevronLeft, faChevronRight, faCloudUploadAlt, faMoon,
  faWalking, faBrain, faArrowUp, faArrowDown, faEllipsisH, faMedal,
  faLock, faTimes, faClock, faMobile, faCoffee, faFire, faSun, faUsers,
  faAppleAlt, faCheck
);

createRoot(document.getElementById("root")!).render(<App />);
