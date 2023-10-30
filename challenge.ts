import fs, { WriteStream } from "fs";

interface Company {
  id: number;
  name: string;
  top_up: number;
  email_status: boolean;
}

interface User {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  company_id: number | null;
  email_status: boolean;
  active_status: boolean;
  tokens: number | null;
}

const readUsersByCompany = async function (): Promise<Map<number, User[]>> {
  try {
    const data = await fs.promises.readFile("users.json", {
      encoding: "utf8",
    });
    const usersData: User[] = JSON.parse(data);

    // sort users by last name ascending
    usersData.sort((a, b) => (a.last_name < b.last_name ? -1 : 1));

    // group users by company
    const usersByCompany = new Map<number, User[]>();

    usersData.forEach((user) => {
      // we need an associated company_id but we can silently fail
      if (!user.company_id) return;

      if (usersByCompany.has(user.company_id)) {
        usersByCompany.get(user.company_id)?.push(user);
      } else {
        usersByCompany.set(user.company_id, [user]);
      }
    });

    return usersByCompany;
  } catch (error) {
    throw new Error("readUsers error: " + error);
  }
};

const readCompanies = async function (): Promise<Company[]> {
  try {
    const data = await fs.promises.readFile("companies.json", {
      encoding: "utf8",
    });

    const companiesData: Company[] = JSON.parse(data);

    return companiesData;
  } catch (error) {
    throw new Error("readCompanies error: " + error);
  }
};

const outputUser = function (
  writeStream: fs.WriteStream,
  company: Company,
  user: User
): number {
  writeStream.write(
    `\t${user.last_name}, ${user.first_name}, ${user.email}\n`,
    "utf8"
  );
  writeStream.write(
    `\t  Previous Token Balance, ${user.tokens ?? 0}\n`,
    "utf8"
  );

  const newTokens = user.active_status ? company.top_up : 0;
  writeStream.write(
    `\t  New Token Balance ${(user.tokens ?? 0) + newTokens}\n`,
    "utf8"
  );

  return newTokens;
};

const outputResults = function (
  writeStream: fs.WriteStream,
  company: Company,
  emailedUsers: User[],
  unEmailedUsers: User[]
) {
  writeStream.write(`Company Id: ${company.id}\n`, "utf8");
  writeStream.write(`Company Name: ${company.name}\n`, "utf8");

  let totalTopUps = 0;

  writeStream.write(`Users Emailed:\n`, "utf8");
  emailedUsers.forEach((user) => {
    totalTopUps += outputUser(writeStream, company, user);
  });

  writeStream.write(`Users Not Emailed:\n`, "utf8");
  unEmailedUsers.forEach((user) => {
    totalTopUps += outputUser(writeStream, company, user);
  });

  writeStream.write(
    `\tTotal amount of top ups for ${company.name}: ${totalTopUps}\n\n`,
    "utf8"
  );
};

async function run() {
  let writeStream;
  try {
    writeStream = fs.createWriteStream("output.txt", { flags: "w" });

    const companies = await readCompanies();
    //console.log(`Read companies: ${companies.length} found`);

    const usersByCompany = await readUsersByCompany();
    //console.log(`Read users: ${usersByCompany.size} found`);

    for (let i = 0; i < companies.length; i++) {
      const company = companies[i];

      let emailedUsers: User[] = [];
      let unEmailedUsers: User[] = [];

      if (!usersByCompany.has(company.id)) continue;

      const users = usersByCompany.get(company.id) as User[];
      for (let j = 0; j < users.length; j++) {
        const user = users[j];

        // we don't display inactive users
        if (!user.active_status) continue;

        if (user.email_status && company.email_status) {
          emailedUsers.push(user);
        } else {
          unEmailedUsers.push(user);
        }
      }
      outputResults(writeStream, company, emailedUsers, unEmailedUsers);
    }
  } catch (err) {
    console.error((err as Error).message);
  } finally {
    if (writeStream) writeStream.end();
  }
}

run();
