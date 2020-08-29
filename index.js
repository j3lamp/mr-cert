const path = require("path");
const fs   = require("fs").promises;

const yargs = require("yargs");

const AppError    = require("./appError");
const CertStorage = require("./certStorage");
const OpenSsl     = require("./openSsl");
const Server      = require("./server");

async function ensureDir(path)
{
    let result       = AppError.ERROR_CODE.NO_ERROR;
    let message      = ""
    let source_error = "";
    try
    {
        const storage_stat = await fs.stat(path);
        if (!storage_stat.isDirectory())
        {
            result  = AppError.ERROR_CODE.DIR_IS_FILE;
            message = `'${path}' is not a directory. Choose a differnt path.`;
        }
    }
    catch(err)
    {
        try
        {
            await fs.mkdir(path, {recursive: true});
        }
        catch(err)
        {
            result        = AppError.ERROR_CODE.DIR_CREATION_FAILED;
            message       = `Could not create directory '${path}'.`;
            source_error = err;
        }
    }

    if (AppError.ERROR_CODE.NO_ERROR != result)
    {
        throw new AppError(message, result, source_error);
    }
}

const ROOT_DIR         = "root_certs";
const INTERMEDIATE_DIR = "intermediate_certs";
const CLIENT_DIR       = "client_certs";
const ALL_DIRS         = [ROOT_DIR,
                          INTERMEDIATE_DIR,
                          CLIENT_DIR];

const REQUIRED_SIGNING_FILES = ["certificate",
                                "key",
                                "index",
                                "serial"];

async function start()
{
    const parser = yargs
          .demandOption("storage-dir")
          .describe("storage-dir", "The directory in which CA files will be stored.")
          .demandOption("scratch-dir")
          .describe("scratch-dir", "Directory used for temporary files.")
          .demandOption("port")
          .number("port")
          .describe("port", "The port the server will use.");

    const arguments = parser.argv

    const storage_dir = path.resolve(arguments.storageDir);
    const scratch_dir = path.resolve(arguments.scratchDir);
    const port        = arguments.port;

    await ensureDir(storage_dir);
    await Promise.all(ALL_DIRS.map((dir) => {
        return ensureDir(path.join(storage_dir, dir));

    }));
    await ensureDir(scratch_dir);

    console.log(`Loading files from ${storage_dir}`);
    const root_storage         = new CertStorage(path.join(storage_dir, ROOT_DIR), REQUIRED_SIGNING_FILES);
    const intermediate_storage = new CertStorage(path.join(storage_dir, INTERMEDIATE_DIR));
    const client_storage       = new CertStorage(path.join(storage_dir, CLIENT_DIR));

    const open_ssl = new OpenSsl(scratch_dir);
    const server   = new Server(root_storage,
                                intermediate_storage,
                                client_storage,
                                open_ssl);

    server.listen(port);
    console.log(`Listening on port ${port}`);
}


start().catch((error) => {
    if (AppError.isAppError(error))
    {
        console.error(error.message);
        if (error.source_error)
        {
            console.error(error.source_error);
        }
        if (error.stack)
        {
            console.error(error.stack);
        }
        process.exit(error.error_code);
    }
    else
    {
        console.error("Uncaught exception!");
        console.error(error);
        process.exit(AppError.ERROR_CODE.UNCAUGHT_EXCEPTION);
    }
});
