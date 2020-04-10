const path = require("path");
const fs   = require("fs").promises;

const AppError = require("./appError");


const CERTIFICATE_EXTENSION = ".crt";
const KEY_EXTENSION         = ".key";

module.exports = class CertStorage
{
    constructor(storage_dir)
    {
        this.storage_dir = storage_dir;
    }

    async getCerts()
    {
        let certs = {};

        const dir = await fs.opendir(this.storage_dir);

        let entry;
        while (entry = await dir.read())
        {
            if (entry.isFile())
            {
                const extension = path.extname(entry.name);
                const name      = path.basename(entry.name, extension);

                const is_certificate = CERTIFICATE_EXTENSION == extension;
                const is_key         = KEY_EXTENSION         == extension;
                if (is_certificate || is_key)
                {
                    if (!certs[name])
                    {
                        certs[name] = {};
                    }

                    if (is_certificate)
                    {
                        certs[name].certificate = entry.name;
                    }
                    else if (is_key)
                    {
                        certs[name].key = entry.name;
                    }
                    else
                    {
                        AppError.weShouldNeverGetHere();
                    }
                }
            }
        }

        // @todo Clean up any entries that don't ahve certs, keys on their own
        //       are useless.

        return certs;
    }
};
