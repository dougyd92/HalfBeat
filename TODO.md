
# Todos

## UI tweak: Show time remaining
Right now, we have a listening-indicator (animated three dots) while the song is playing.
However, the players have no way of knowing how much time is left to guess.
Ideas: 
- Show a numerical counter
- Show a circle that's like a stopwatch without numbers; it kind of looks like a pie chart, where the time remaining % is steadily decresing.


## Last Chance
If no player buzzes in by the time the song ends,
the Last Chance guessing period will begin.
ALL players will be given the opportunity to submit a guess.
The correct answer will not be revealed until all active players have submitted.
If a player still has not entered a guess after 5 seconds, their guess is forfeit.
All players who submitted a correct guess in the Last Chance opportunity will receive half a point.


## Second Chance
If the first player who buzzes in guesses incorrectly,
currently the correct song is revealed, no points are scored, and play proceeds to the 
next round.
This creates an opportunity for a player to block out others from guessing, 
even if they themself do not know the answer.
Instead, other players should also have a chance to answer.
When a player buzzes in:
- They are prompted to enter their guess
- If their guess is correct, they score 1 point, and play moves to the next round
- If their guess is incorrect, the current round should reset. Everything is the same
as if it were a new round, but the player who buzzed incorrectly no longer has the
ability to buzz in.
- If there are no players left who are eligible to guess, then play should automatically
move on to the Last Chance oppportunity.
