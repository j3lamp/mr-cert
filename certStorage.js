const fs   = require("fs").promises;
const path = require("path");

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

        await dir.close();

        // @todo Clean up any entries that don't have certs, keys on their own
        //       are useless.

        return certs;
    }

    async getCert(name)
    {
        let cert = null;

        const dir = await fs.opendir(this.storage_dir);

        let entry;
        while (entry = await dir.read())
        {
            if (entry.isFile())
            {
                const extension = path.extname(entry.name);
                if (path.basename(entry.name, extension) == name)
                {
                    const is_certificate = CERTIFICATE_EXTENSION == extension;
                    const is_key         = KEY_EXTENSION         == extension;
                    if (is_certificate || is_key)
                    {
                        if (!cert)
                        {
                            cert = {};
                        }

                        if (is_certificate)
                        {
                            cert.certificate = entry.name;
                        }
                        else if (is_key)
                        {
                            cert.key = entry.name;
                        }
                        else
                        {
                            AppError.weShouldNeverGetHere();
                        }
                    }
                }
            }
        }

        await dir.close();

        return cert;
    }

    async storeCert(name, certificate_path, key_path)
    {
        const certificate_name = `${name}${CERTIFICATE_EXTENSION}`;
        await fs.rename(certificate_path, path.join(this.storage_dir,
                                                    certificate_name));
        if (key_path)
        {
            await fs.rename(key_path, path.join(this.storage_dir,
                                                `${name}${KEY_EXTENSION}`));
        }

        return certificate_name;
    }
};
