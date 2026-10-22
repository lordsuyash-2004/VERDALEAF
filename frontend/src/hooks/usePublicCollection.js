import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";

export function usePublicCollection(path) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const requestRef = useRef();

  const reload = useCallback(async () => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true);
    setError(false);
    try {
      const response = await axios.get(`${process.env.REACT_APP_BACKEND_URL}/api/${path}`, {
        withCredentials: false,
        timeout: 15000,
        signal: controller.signal,
      });
      if (!Array.isArray(response.data)) throw new Error("Invalid collection response");
      if (!controller.signal.aborted) setItems(response.data);
    } catch (err) {
      if (!controller.signal.aborted && !axios.isCancel(err)) setError(true);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    reload();
    return () => requestRef.current?.abort();
  }, [reload]);

  return { items, loading, error, reload };
}