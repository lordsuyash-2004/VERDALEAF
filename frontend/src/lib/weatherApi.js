import axios from "axios";

const WEATHER_API = `${process.env.REACT_APP_BACKEND_URL}/api/weather`;

// Weather is public: never inherit the login client's credentialed CORS mode.
export async function getWeather(path, params, signal) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await axios.get(`${WEATHER_API}/${path}`, {
        params,
        signal,
        withCredentials: false,
        timeout: 15000,
      });
      return response.data;
    } catch (error) {
      const status = error.response?.status;
      const transient = !status || [500, 502, 503, 504].includes(status);
      if (signal.aborted || axios.isCancel(error) || !transient || attempt === 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, 400));
    }
  }
}

export function weatherError(error) {
  const detail = error.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (error.code === "ECONNABORTED") return "Weather is taking too long to respond. Please retry.";
  if (!error.response) return "Couldn't connect to weather. Check your connection and retry.";
  return "Weather is temporarily unavailable. Please retry.";
}