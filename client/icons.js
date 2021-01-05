"use strict"

import m from "mithril";


import Certificate   from "@mithril-icons/font-awesome/solid/icons/Certificate.js";
import CompactDisc   from "@mithril-icons/font-awesome/solid/icons/CompactDisc.js";
import Eye           from "@mithril-icons/font-awesome/solid/icons/Eye.js";
import FileDownload  from "@mithril-icons/font-awesome/solid/icons/FileDownload.js";
import FileSignature from "@mithril-icons/font-awesome/solid/icons/FileSignature.js";
import FileUpload    from "@mithril-icons/font-awesome/solid/icons/FileUpload.js";
import Key           from "@mithril-icons/font-awesome/solid/icons/Key.js";
import Link          from "@mithril-icons/font-awesome/solid/icons/Link.js";
import Plus          from "@mithril-icons/font-awesome/solid/icons/Plus.js";
import PlusSquare    from "@mithril-icons/font-awesome/solid/icons/PlusSquare.js";


const icon_map = {
    certificate:   Certificate,
    compactDisc:   CompactDisc,
    eye:           Eye,
    fileDownload:  FileDownload,
    fileSignature: FileSignature,
    fileUpload:    FileUpload,
    key:           Key,
    link:          Link,
    plus:          Plus,
    plusSquare:    PlusSquare
};

const icons = (function()
{
    let result = {};
    for (name in icon_map)
    {
        const icon = icon_map[name];

        result[name] = (...rest) => { return m(icon, ...rest); };
    }

    result.addTo = (content, icon=null, ...rest) => {
        if (icon && result[icon])
        {
            return [result[icon](...rest), " ", content];
        }
        else
        {
            return content;
        }
    }

    return result;
})();


export default icons;
