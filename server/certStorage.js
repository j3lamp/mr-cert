const fs   = require("fs").promises;
const path = require("path");

const AppError = require("./appError");
const File     = require("./file");


const CERTIFICATE_EXTENSION = ".crt";
const KEY_EXTENSION         = ".key";
const ATTRIBUTES_FILE_NAME  = "_attributes_";


module.exports = class CertStorage
{
    constructor(storage_dir, required_files=["certificate"])
    {
        this.storage_dir    = storage_dir;
        this.required_files = required_files;
    }

    getFilePath(name, file)
    {
        return path.join(this.storage_dir, name, file);
    }

    /*!
     * @brief Get all certificates
     *
     * @details
     * Get the attributes and associated files for all certificates stored. The
     * files are listed in the 'files' attribute. If a certificate is missing
     * any of the required files it will not be listed.
     *
     * @returns Array of Objects
     */
    async getCerts(max=Infinity)
    {
        let certs      = {};
        let cert_count = 0;

        const storage = await fs.opendir(this.storage_dir);

        let entry;
        while (cert_count < max && (entry = await storage.read()))
        {
            if (entry.isDirectory())
            {
                const entry_path = path.join(this.storage_dir, entry.name);
                const entry_dir  = await fs.opendir(entry_path);

                let attributes = {};
                let files      = [];
                let file;
                while (file = await entry_dir.read())
                {
                    if (file.isFile())
                    {
                        if (ATTRIBUTES_FILE_NAME == file.name)
                        {
                            try
                            {
                                const attributes_path = path.join(entry_path,
                                                                  file.name);
                                const attributes_json =
                                      await File.readFile(attributes_path);
                                attributes = JSON.parse(attributes_json);
                            }
                            catch (error)
                            {
                                console.error(error);
                            }
                        }
                        else
                        {
                            files.push(file.name);
                        }
                    }
                }

                const valid = this.required_files.reduce(
                    (valid, required_file) => {
                        if (valid)
                        {
                            const entry_valid = files.includes(required_file);
                            if (!entry_valid)
                            {
                                console.log(`Entry "${entry.name}" is missing "${required_file}".`);
                            }
                            valid = entry_valid;
                        }

                        return valid;
                    },
                    true);

                if (valid)
                {
                    attributes.files = files;
                    certs[entry.name] = attributes
                }

                await entry_dir.close();
            }
        }

        await storage.close();

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

    /*!
     * @brief Appropriately stores certificates and associated files.
     *
     * @details
     * All files provided in @a paths are stored in a directory with @a name, if
     * said directory doesn't already exist. @a paths must be an object in which
     * the keys are the destination file name and the values are their current
     * absolute paths. The @a paths object *must* have a key for every entry in
     * the @a required_files array passed into the constructor.
     */
    async storeCert(name, paths, attributes=null)
    {
        for (const file of this.required_files)
        {
            if (!paths[file])
            {
                return false;
            }
        }

        const cert_dir = path.join(this.storage_dir, name);
        await fs.mkdir(cert_dir);

        let tasks = [];
        for (const file in paths)
        {
            tasks.push(fs.rename(paths[file], path.join(cert_dir, file)));
        }
        if (attributes)
        {
            tasks.push(File.writeFile(path.join(cert_dir, ATTRIBUTES_FILE_NAME),
                                      JSON.stringify(attributes)));
        }
        await Promise.all(tasks);

        return name;
    }
};
