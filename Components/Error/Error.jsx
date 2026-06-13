import React from "react";
import Style from "./Error.module.css";

const Error = ({ error, setError }) => {
  return (
    <div className={Style.Error}>
      <div className={Style.Error_box}>
        <button onClick={() => setError && setError("")} className={Style.Error_box_close_x} aria-label="Close error modal">
          &times;
        </button>
        <h1>Please Fix This Error & Reload</h1>
        <p>{error}</p>
        <button onClick={() => setError && setError("")} className={Style.Error_close_btn}>
          Close
        </button>
      </div>
    </div>
  );
};

export default Error;