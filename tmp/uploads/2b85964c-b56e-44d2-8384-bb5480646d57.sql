create database company_db7;
use company_db7;

create table departments (
dept_id INT PRIMARY KEY AUTO_INCREMENT,
dept_name VARCHAR(50)  NOT NULL 
);

create table ranks(
rank_id INT PRIMARY KEY auto_increment,
rank_name VARCHAR(50)  NOT NULL
);

create table employee(
emp_id INT PRIMARY KEY auto_increment,
emp_name VARCHAR(50) NOT NULL ,
emp_email VARCHAR(100) not null unique,
salary decimal(10,2) check(salary>=0),
dept_id INT,
rank_id INT,
age INT not null ,
DOB DATE NOT NULL,
joining_date DATE NOT NULL,
FOREIGN KEY (dept_id) references departments(dept_id),
FOREIGN KEY (rank_id) references ranks(rank_id)
);

INSERT INTO departments (dept_name) VALUES
('IT'),
('HR'),
('Marketing'),
('Finance'),
('Sales'),
('Operations'),
('Customer Support'),
('Legal'),
('R&D'),
('Admin');

INSERT INTO ranks (rank_name) VALUES
('CEO'),
('Vice President'),
('Director'),
('Manager'),
('Team Lead'),
('Senior Developer'),
('Developer'),
('Junior Developer'),
('Intern'),
('Analyst');

INSERT INTO employee (emp_name, emp_email, salary, age, DOB, joining_date, dept_id, rank_id) 
VALUES
('Amit Sharma', 'amit1@gmail.com', 50000, 26, '1998-03-12', '2022-06-01', 1, 7),
('Priya Singh', 'priya1@gmail.com', 60000, 28, '1996-07-22', '2021-08-15', 2, 6),
('Rahul Verma', 'rahul1@gmail.com', 45000, 25, '1999-01-10', '2023-02-10', 3, 7),
('Sneha Patil', 'sneha1@gmail.com', 70000, 30, '1994-09-18', '2020-11-05', 4, 5),
('Rohit Gupta', 'rohit1@gmail.com', 30000, 23, '2001-05-25', '2024-01-12', 5, 8),
('Anjali Mehta', 'anjali1@gmail.com', 55000, 27, '1997-04-14', '2022-03-18', 6, 7),
('Vikas Yadav', 'vikas1@gmail.com', 65000, 29, '1995-11-30', '2021-09-09', 7, 6),
('Neha Kapoor', 'neha1@gmail.com', 80000, 32, '1992-02-11', '2019-07-21', 8, 5),
('Karan Malhotra', 'karan1@gmail.com', 150000, 40, '1984-06-05', '2015-04-01', 9, 2),
('Pooja Sharma', 'pooja1@gmail.com', 200000, 45, '1979-12-19', '2010-10-10', 10, 1),
('Ramesh Kumar', 'ramesh1@gmail.com', 35000, 24, '2000-08-08', '2023-05-20', 1, 9),
('Sita Devi', 'sita1@gmail.com', 40000, 26, '1998-03-03', '2022-12-01', 2, 7),
('Arjun Singh', 'arjun1@gmail.com', 62000, 28, '1996-06-17', '2021-06-25', 3, 6),
('Meera Joshi', 'meera1@gmail.com', 85000, 33, '1991-09-09', '2018-08-30', 4, 5),
('Deepak Mishra', 'deepak1@gmail.com', 95000, 35, '1989-02-20', '2017-03-15', 5, 4),
('Kavita Nair', 'kavita1@gmail.com', 52000, 27, '1997-07-07', '2022-02-11', 6, 7),
('Nikhil Jain', 'nikhil1@gmail.com', 72000, 31, '1993-10-10', '2020-09-19', 7, 5),
('Simran Kaur', 'simran1@gmail.com', 88000, 34, '1990-04-04', '2018-11-11', 8, 5),
('Aakash Shah', 'aakash1@gmail.com', 97000, 36, '1988-01-01', '2016-07-07', 9, 4),
('Divya Reddy', 'divya1@gmail.com', 105000, 38, '1986-05-05', '2014-05-05', 10, 3),
('Manish Tiwari', 'manish1@gmail.com', 25000, 22, '2002-09-09', '2024-02-01', 1, 8),
('Tina Roy', 'tina1@gmail.com', 30000, 23, '2001-12-12', '2023-10-10', 2, 9),
('Yash Patel', 'yash1@gmail.com', 45000, 26, '1998-11-11', '2022-04-04', 3, 7),
('Zoya Khan', 'zoya1@gmail.com', 60000, 29, '1995-03-15', '2021-01-20', 4, 6),
('Aditya Das', 'aditya1@gmail.com', 70000, 30, '1994-08-18', '2020-06-06', 5, 5);

select * from employee;

SELECT * FROM departments;

select * from employee;
SELECT emp_name,age FROM employee;
SELECT emp_name,DOB,joining_date FROM employee;

UPDATE employee
set DOB = '1998-03-19',
    salary = 190000,
    joining_date = '2022-06-19'
    where emp_id = 1;

INSERT INTO employee 
(emp_name, emp_email, salary, age, DOB, joining_date, dept_id, rank_id)
VALUES (
'Rohan kapoor','rohan@gmail.com',150000,38,'1985-05-10','2023-01-01',
(SELECT dept_id FROM departments WHERE dept_name='IT'),
(SELECT rank_id FROM ranks WHERE rank_name='Vice President')),
 (
'Rajveer singh','rajveer@gmail.com',180000,22,'2003-06-19','2024-06-15',
(SELECT dept_id FROM departments WHERE dept_name='IT'),
(SELECT rank_id FROM ranks WHERE rank_name='Vice President'));

select * from employee;
select * from departments;
select * from ranks;

select e.* 
from employee e 
join departments d 
on e.dept_id=d.dept_id
where d.dept_name='IT';

update employee
set salary = 10000
where emp_name ='Rohit Gupta';

SET SQL_SAFE_UPDATES = 0;

SELECT * FROM employee WHERE emp_name = 'Rohit Gupta';

update employee 
set joining_date = '2021-04-21'
where emp_name = 'Yash Patel';

delete from employee where emp_name = 'Zoya Khan';

insert into departments (dept_name) values('Administration');
insert into ranks (rank_name) values('Trainee');

update employee 
set salary =salary*10;

select count(*) from employee;
select count(*) from employee where age<25;
select count(*) from employee where age>30;
select count(*) from employee where age between 25 and 45;


update employee 
set salary =salary*0.5 
where year(joining_date)<2021;

select e.emp_name,e.age,e.joining_date ,r.rank_name,d.dept_name
from employee e
inner join ranks r
on e.rank_id=r.rank_id
inner join departments d
on e.dept_id=d.dept_id
having year(joining_date)<2021;

select * from employee where age<30 and salary>100000;

alter table employee add createdat timestamp default current_timestamp;
alter table employee add createdby varchar(50);
alter table employee 
add lastupdatedat timestamp default current_timestamp on update current_timestamp,
add lastupdateby varchar(50);

select * from employee;

alter table departments 
add createdat timestamp default current_timestamp,
add createdby varchar(50),
add lastupdatedat timestamp default current_timestamp on update current_timestamp,
add lastupdateby varchar(50);

alter table ranks 
add createdat timestamp default current_timestamp,
add createdby varchar(50),
add lastupdatedat timestamp default current_timestamp on update current_timestamp,
add lastupdatedby varchar(50);

create table salhistory (
id INT PRIMARY KEY AUTO_INCREMENT,
emp_id int not null,
salary decimal(10,2), 
effective_from date not null,
effective_to date ,
FOREIGN KEY (emp_id) references employee(emp_id)
);


INSERT INTO salhistory (emp_id, salary, effective_from, effective_to)
VALUES
-- Employee 1 history
(1, 40000, '2020-01-01', '2022-01-01'),
(1, 50000, '2022-01-02', NULL),

-- Employee 2 history
(2, 30000, '2019-05-10', '2021-06-15'),
(2, 45000, '2021-06-16', NULL),

-- Employee 3 history
(3, 35000, '2021-01-01', '2023-01-01'),
(3, 55000, '2023-01-02', NULL),

-- Employee 4 history
(4, 60000, '2018-03-01', '2020-03-01'),
(4, 80000, '2020-03-02', '2023-03-01'),
(4, 95000, '2023-03-02', NULL),

-- Employee 5 history
(5, 25000, '2022-01-01', NULL);

-- Part 5: Complex SQL Queries & Joins

select e.emp_id,e.emp_name,s.salary,DATEDIFF(ifnull(s.effective_to,curdate()),
s.effective_from
)as effective_days
FROM salhistory s
JOIN employee e ON s.emp_id = e.emp_id
JOIN departments d ON e.dept_id = d.dept_id
JOIN ranks r ON e.rank_id = r.rank_id
WHERE d.dept_name = 'IT'; 


select d.dept_name as divison,count(e.emp_id) as employeeCount 
from employee e
join departments d
on e.emp_id = d.dept_id
group by d.dept_name
order by employeeCount desc;

select emp_id,emp_name ,salary,
CASE 
  WHEN TIMESTAMPDIFF(YEAR, joining_date, CURDATE())>4 then salary * 1.10
  WHEN TIMESTAMPDIFF(YEAR,joining_date,CURDATE())>2 then salary * 1.06
  else salary *1.04
END AS new_salary
FROM employee;

select d.dept_name as divisonName, sum(e.salary) as totalSalary 
from employee e
join departments d
on e.dept_id=d.dept_id
group by d.dept_name
order by totalSalary desc;

SELECT 
d.dept_name AS division,
ROUND(AVG(e.salary), 2) AS avg_salary
FROM employee e
JOIN departments d 
ON e.dept_id = d.dept_id
GROUP BY d.dept_name;

SELECT 
d.dept_name AS division,
MAX(e.salary) AS max_salary
FROM employee e
JOIN departments d 
ON e.dept_id = d.dept_id
GROUP BY d.dept_name;

SELECT 
CASE 
WHEN age < 20 THEN 'Below 20'
WHEN age BETWEEN 20 AND 40 THEN '20-40'
WHEN age BETWEEN 41 AND 50 THEN '40-50'
WHEN age BETWEEN 51 AND 60 THEN '50-60'
ELSE 'Above 60'
END AS age_group,
COUNT(*) AS total
FROM employee
GROUP BY age_group;

ALTER TABLE employee ADD manager_id INT;

SELECT 
e.emp_name AS employee,
m.emp_name AS reporting_officer
FROM employee e
LEFT JOIN employee m 
ON e.manager_id = m.emp_id
JOIN ranks r ON e.rank_id = r.rank_id
ORDER BY r.rank_id ASC, e.emp_name ASC;

SELECT SUM(salary) AS total_salary
FROM employee
WHERE manager_id = 1
OR manager_id IN (
    SELECT emp_id 
    FROM employee 
    WHERE manager_id = 1
);