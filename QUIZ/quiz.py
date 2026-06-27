print("Welcome to the Quiz")
score=0
user_name=input("Enter user name: ")

#QUESTION 1
print("1. What is the largest river on planet earth?")
print("a. yamuna")
print("b. sangam")
print("c. Nile")
print("d. mandakini")
answer=input("What is your answer: ").strip().lower()
if answer=="c":
    print("correct")
    score=score+1
else:
    print("incorrect")  

#QUESTION 2
print("2. what is 2+2")
print("a. 4") 
print("b. 5")
print("c. 6")
print("d. 50")
answer=input("what is your answer: ").strip().lower()
if answer=="a":
    print("correct")
    score=score+1
else:
    print("incorrect")

#QUESTION 3
print("3. What is largest ocean")
print("a. pacific ocean")
print("b. atlantic ocean")
print("c. indian ocean")
print("d. dont know")           
answer=input("what is your answer: ").strip().lower()
if answer=="a":
    print("correct")
    score=score+1
else:
    print("incorrect")

#QUESTION 4
print("4. what is most boring subject")
print("a. History")
print("b. geography")
print("c. civics")
print("d. all of these")
answer=input("what is your answer: ").strip().lower()
if answer=="d":
    print("correct")
    score=score+1
else:
    print("incorrect")             

print("Your score:", score)
print("you did your best thank you for using the quiz")   