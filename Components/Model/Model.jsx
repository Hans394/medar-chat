import React, { useState } from "react";
import Image from "next/image";

import Style from "./Model.module.css";
import images from "../../assets";

const Model = ({ openBox, title, head, info, smallInfo, functionName, address }) => {
  const [name, setName] = useState("");
  const [userAddress, setUserAddress] = useState("");

  return (
    <div className={Style.Model}>
      <div className={Style.Model_box}>
        <div className={Style.Model_box_left}>
          <Image src={images.buddy} alt="buddy" width={700} height={700} />
        </div>
        <div className={Style.Model_box_right}>
          <h1>{title} <span>{head}</span></h1>
          <p>{info}</p>
          <small>{smallInfo}</small>

          <div className={Style.Model_box_right_name}>
            <div className={Style.Model_box_right_name_info}>
              <Image src={images.username} alt="user" width={30} height={30} />
              <input type="text" placeholder="your name" onChange={(e) => setName(e.target.value)} />
            </div>
            <div className={Style.Model_box_right_name_info}>
              <Image src={images.account} alt="user" width={30} height={30} />
              <input type="text" placeholder="0x7000..." onChange={(e) => setUserAddress(e.target.value)} />
            </div>

            <div className={Style.Model_box_right_name_btn}>
              <button onClick={() => functionName({ name, userAddress })}>
                <Image src={images.send} alt="send" width={30} height={30} />
                Submit
              </button>
              <button onClick={() => openBox(false)}>
                <Image src={images.close} alt="close" width={30} height={30} />
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Model;