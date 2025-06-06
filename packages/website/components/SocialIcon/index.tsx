import { useContext, useMemo, useState } from "react";
import { SocialItem } from "../../api/getAllData";
import { getIcon } from "../../utils/getIcon";
import { Popover, ArrowContainer } from "react-tiny-popover";
import { capitalize } from "../../utils/capitalize";
import { ThemeContext } from "../../utils/themeContext";
import ImageBox from "../ImageBox";

export default function (props: { item: SocialItem }) {
  const { theme } = useContext(ThemeContext);

  // 获取显示名称
  const displayName = useMemo(() => {
    if (props.item.displayName) {
      return props.item.displayName;
    }
    // 兼容旧版本
    if (props.item.type === "email") {
      return "Email";
    }
    return capitalize(props.item.type);
  }, [props.item]);

  // 获取链接类型
  const linkType = useMemo(() => {
    if (props.item.linkType) {
      return props.item.linkType;
    }
    // 兼容旧版本
    if (props.item.type === "email") {
      return "email";
    }
    if (props.item.type === "wechat" || props.item.type === "wechat-dark") {
      return "qrcode";
    }
    return "link";
  }, [props.item]);

  // 获取二维码URL（用于微信等）
  const qrCodeUrl = useMemo(() => {
    if (linkType === "qrcode") {
      // 优先使用darkValue
      if (props.item.darkValue) {
        if (theme.includes("dark") && props.item.darkValue) {
          return props.item.darkValue;
        }
        return props.item.value;
      }
      // 兼容旧版本的微信处理
      if (props.item.type === "wechat") {
        if (theme.includes("dark") && props.item.dark && props.item.dark !== "") {
          return props.item.dark;
        }
        return props.item.value;
      }
      return props.item.value;
    }
    return "";
  }, [theme, props.item, linkType]);

  // 获取图标
  const iconElement = useMemo(() => {
    const iconSize = 20;
    
    // 优先使用iconName对应的图标（新版本）
    if (props.item.iconName) {
      // 这里应该从图标管理系统获取图标，暂时使用customIconUrl作为fallback
      if (props.item.customIconUrl) {
        const iconUrl = theme.includes("dark") && props.item.customIconUrlDark 
          ? props.item.customIconUrlDark 
          : props.item.customIconUrl;
          
        return (
          <img 
            src={iconUrl} 
            alt={displayName}
            width={iconSize} 
            height={iconSize}
            style={{ objectFit: 'contain' }}
          />
        );
      }
    }
    
    // 兼容旧版本：如果有自定义图标URL
    if (props.item.customIconUrl) {
      const iconUrl = theme.includes("dark") && props.item.customIconUrlDark 
        ? props.item.customIconUrlDark 
        : props.item.customIconUrl;
        
      return (
        <img 
          src={iconUrl} 
          alt={displayName}
          width={iconSize} 
          height={iconSize}
          style={{ objectFit: 'contain' }}
        />
      );
    }
    
    // 使用预设图标
    const iconType = props.item.iconType || props.item.type;
    return getIcon(iconType as any, iconSize);
  }, [props.item, theme, displayName]);

  const arrowColor = useMemo(() => {
    if (theme.includes("dark")) {
      return "#1b1c1f";
    } else {
      return "white";
    }
  }, [theme]);

  const [show, setShow] = useState(false);
  const [emailShow, setEmailShow] = useState(false);
  const iconStyle = { marginLeft: "12px" };
  const iconClass = "fill-gray-500 dark:text-dark dark:group-hover:text-dark-r transition-all ";

  // 邮箱类型
  if (linkType === "email") {
    return (
      <Popover
        isOpen={emailShow}
        onClickOutside={() => {
          setEmailShow(false);
        }}
        positions={["top", "left"]}
        content={({ position, childRect, popoverRect }) => {
          return (
            <ArrowContainer
              position={position}
              childRect={childRect}
              popoverRect={popoverRect}
              arrowColor={arrowColor}
              arrowSize={10}
              arrowStyle={{ opacity: 0.7 }}
              className=" "
              arrowClassName="popover-arrow "
            >
              <div
                className="card-shadow bg-white dark:bg-dark-2 dark:card-shadow-dark p-4 rounded-lg"
                style={{ maxWidth: 300 }}
              >
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  点击邮箱地址复制到剪贴板：
                </div>
                <div 
                  className="bg-gray-100 dark:bg-gray-700 p-2 rounded cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  onClick={() => {
                    navigator.clipboard.writeText(props.item.value);
                    setEmailShow(false);
                  }}
                >
                  <span className="text-blue-600 dark:text-blue-400 break-all">
                    {props.item.value}
                  </span>
                </div>
                <div className="text-xs text-gray-500 mt-2">
                  或者使用邮件客户端打开：
                </div>
                <a
                  href={`mailto:${props.item.value}`}
                  className="text-blue-600 dark:text-blue-400 hover:underline text-sm mt-1 inline-block"
                >
                  在邮件客户端中打开
                </a>
              </div>
            </ArrowContainer>
          );
        }}
      >
        <a
          style={{
            display: "inline-flex",
            width: "100%",
            justifyContent: "start",
          }}
          onClick={(e) => {
            e.preventDefault();
            setEmailShow(!emailShow);
          }}
          href="#"
        >
          <span className={iconClass} style={iconStyle}>
            {iconElement}
          </span>
          <span className="inline-flex items-center ml-1">{displayName}</span>
        </a>
      </Popover>
    );
  } 
  // 二维码类型（微信、微信公众号等）
  else if (linkType === "qrcode") {
    return (
      <Popover
        isOpen={show}
        onClickOutside={() => {
          setShow(false);
        }}
        positions={["top", "left"]}
        content={({ position, childRect, popoverRect }) => {
          return (
            <ArrowContainer
              position={position}
              childRect={childRect}
              popoverRect={popoverRect}
              arrowColor={arrowColor}
              arrowSize={10}
              arrowStyle={{ opacity: 0.7 }}
              className=" "
              arrowClassName="popover-arrow "
            >
              <div
                className="card-shadow bg-white dark:bg-dark-2 dark:card-shadow-dark"
                style={{ height: 280 }}
              >
                <ImageBox
                  alt={`${displayName} qrcode`}
                  src={qrCodeUrl}
                  width={200}
                  height={280}
                  className={""}
                  lazyLoad={true}
                />
              </div>
            </ArrowContainer>
          );
        }}
      >
        <a
          target={"_blank"}
          style={{
            display: "inline-flex",
            width: "100%",
            justifyContent: "start",
          }}
          onClick={() => {
            setShow(!show);
          }}
        >
          <span style={iconStyle} className={iconClass}>
            {iconElement}
          </span>
          <span className="inline-flex items-center ml-1">
            {displayName}
          </span>
        </a>
      </Popover>
    );
  } 
  // 普通链接类型
  else {
    return (
      <a
        style={{
          display: "inline-flex",
          width: "100%",
          justifyContent: "start",
        }}
        href={props.item.value}
        target="_blank"
      >
        <span style={iconStyle} className={iconClass}>
          {iconElement}
        </span>
        <span className="inline-flex items-center ml-1">
          {displayName}
        </span>
      </a>
    );
  }
}
