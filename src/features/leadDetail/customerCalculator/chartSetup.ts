import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from "chart.js";

// Ported verbatim from apps/client/src/features/charts/chartSetup.ts - this
// section renders the same charts the customer wizard shows, read-only, so
// it needs the same chart.js element registration.
ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Legend, Tooltip);

export const barTooltipOptions = {
  backgroundColor: "#fff",
  titleColor: "#000",
  bodyColor: "#000",
  borderColor: "#000",
  borderWidth: 1,
  displayColors: false,
};
